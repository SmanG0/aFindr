"""Git-based strategy version tracking.

Maintains a local git repository of strategy versions for full audit trail.
Each strategy save creates a commit with the code, parameters, and metrics.
Provides diff view between versions and complete history.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Optional, List, Dict

try:
    import git
    HAS_GIT = True
except ImportError:
    HAS_GIT = False

STRATEGY_REPO_DIR = Path(__file__).parent.parent / "strategy_versions"


class StrategyGit:
    """Git-backed strategy version control."""

    def __init__(self, repo_dir: Path = STRATEGY_REPO_DIR):
        self.repo_dir = repo_dir
        self.repo: Optional[git.Repo] = None

        if not HAS_GIT:
            return

        self._init_repo()

    def _init_repo(self):
        """Initialize or open the strategy git repo."""
        if not self.repo_dir.exists():
            self.repo_dir.mkdir(parents=True, exist_ok=True)

        try:
            self.repo = git.Repo(str(self.repo_dir))
        except (git.InvalidGitRepositoryError, git.NoSuchPathError):
            self.repo = git.Repo.init(str(self.repo_dir))
            # Create initial commit
            readme = self.repo_dir / "README.md"
            readme.write_text("# Strategy Versions\n\nAuto-managed by aFindr strategy audit trail.\n")
            self.repo.index.add(["README.md"])
            self.repo.index.commit("Initial commit")

    @property
    def is_available(self) -> bool:
        return self.repo is not None

    def save_version(
        self,
        strategy_name: str,
        code: str,
        parameters: Dict,
        metrics: Optional[Dict] = None,
        description: str = "",
        session_id: str = "",
        iteration: int = 0,
    ) -> Optional[str]:
        """Save a strategy version as a git commit.

        Returns the commit hash, or None if git is not available.
        """
        if not self.is_available:
            return None

        # Sanitize strategy name for filename
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in strategy_name)
        strategy_dir = self.repo_dir / safe_name
        strategy_dir.mkdir(exist_ok=True)

        # Write strategy code
        code_file = strategy_dir / "strategy.py"
        code_file.write_text(code)

        # Write parameters
        params_file = strategy_dir / "params.json"
        params_file.write_text(json.dumps(parameters, indent=2))

        # Write metrics if available
        if metrics:
            metrics_file = strategy_dir / "metrics.json"
            metrics_file.write_text(json.dumps(metrics, indent=2, default=str))

        # Write metadata
        meta = {
            "name": strategy_name,
            "description": description,
            "session_id": session_id,
            "iteration": iteration,
            "timestamp": time.time(),
        }
        meta_file = strategy_dir / "meta.json"
        meta_file.write_text(json.dumps(meta, indent=2))

        # Stage and commit
        rel_paths = [
            str(Path(safe_name) / "strategy.py"),
            str(Path(safe_name) / "params.json"),
            str(Path(safe_name) / "meta.json"),
        ]
        if metrics:
            rel_paths.append(str(Path(safe_name) / "metrics.json"))

        self.repo.index.add(rel_paths)

        commit_msg = f"{strategy_name}"
        if iteration > 0:
            commit_msg += f" (iteration {iteration})"
        if metrics:
            sharpe = metrics.get("sharpe_ratio", "N/A")
            pf = metrics.get("profit_factor", "N/A")
            commit_msg += f"\n\nSharpe: {sharpe}, PF: {pf}"

        commit = self.repo.index.commit(commit_msg)
        return str(commit.hexsha)

    def get_diff(
        self,
        strategy_name: str,
        commit_a: Optional[str] = None,
        commit_b: Optional[str] = None,
    ) -> Optional[str]:
        """Get diff between two versions of a strategy.

        If commit_a/b not specified, compares the two most recent versions.
        """
        if not self.is_available:
            return None

        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in strategy_name)
        strategy_path = f"{safe_name}/strategy.py"

        history = self.get_history(strategy_name)
        if len(history) < 2 and not (commit_a and commit_b):
            return None

        if not commit_a:
            commit_a = history[1]["hash"]
        if not commit_b:
            commit_b = history[0]["hash"]

        try:
            a = self.repo.commit(commit_a)
            b = self.repo.commit(commit_b)
            diff = a.diff(b, paths=[strategy_path], create_patch=True)
            if diff:
                return diff[0].diff.decode("utf-8", errors="replace")
        except Exception:
            pass

        return None

    def get_history(
        self,
        strategy_name: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict]:
        """Get commit history for a strategy or all strategies.

        Returns list of {hash, message, timestamp, author} dicts.
        """
        if not self.is_available:
            return []

        try:
            if strategy_name:
                safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in strategy_name)
                commits = list(self.repo.iter_commits(paths=safe_name, max_count=limit))
            else:
                commits = list(self.repo.iter_commits(max_count=limit))

            return [
                {
                    "hash": str(c.hexsha)[:8],
                    "full_hash": str(c.hexsha),
                    "message": c.message.strip(),
                    "timestamp": c.committed_date,
                    "date": time.strftime("%Y-%m-%d %H:%M", time.localtime(c.committed_date)),
                }
                for c in commits
            ]
        except Exception:
            return []

    def list_strategies(self) -> List[str]:
        """List all tracked strategy names."""
        if not self.is_available:
            return []

        strategies = []
        for item in self.repo_dir.iterdir():
            if item.is_dir() and (item / "strategy.py").exists():
                strategies.append(item.name)
        return sorted(strategies)


# Singleton instance
_git_store: Optional[StrategyGit] = None


def get_strategy_git() -> StrategyGit:
    """Get or create the singleton StrategyGit instance."""
    global _git_store
    if _git_store is None:
        _git_store = StrategyGit()
    return _git_store
