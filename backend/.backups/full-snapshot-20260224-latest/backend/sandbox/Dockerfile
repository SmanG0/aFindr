FROM python:3.11-slim

# Install strategy dependencies
RUN pip install --no-cache-dir \
    pandas>=2.2.0 \
    numpy>=1.26.0 \
    ta>=0.11.0 \
    vectorbt>=0.26.0 \
    scipy>=1.12.0

# Create non-root user for security
RUN useradd -m -s /bin/bash executor
USER executor
WORKDIR /home/executor

# Copy the executor script
COPY executor.py /home/executor/executor.py

# No network access
# Memory limit and read-only FS enforced at container creation time

ENTRYPOINT ["python", "/home/executor/executor.py"]
