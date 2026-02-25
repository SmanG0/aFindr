# Finance Influencer Headshots

Headshots are downloaded via **DuckDuckGo image search** using:

```bash
pip install duckduckgo-search
python3 scripts/download_headshots.py
```

Images are saved to `public/headshots/` and used by the dashboard. The script skips already-downloaded files and handles rate limits with retries.

## Manual download (if script is rate-limited)

Right-click each link and choose **Save Link As** to save. Rename to match the slug (e.g. `warren-buffett.jpg`) and put in `public/headshots/`.

## Wikimedia Commons links (15 people)

| Person | Download link |
|--------|---------------|
| Warren Buffett | [warren-buffett.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Warren_Buffett_KU_Visit.jpg/440px-Warren_Buffett_KU_Visit.jpg) |
| Charlie Munger | [charlie-munger.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Charlie_Munger_%28cropped%29.jpg/440px-Charlie_Munger_%28cropped%29.jpg) |
| Benjamin Graham | [benjamin-graham.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg/440px-Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg) |
| John Maynard Keynes | [john-maynard-keynes.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/John_Maynard_Keynes.jpg/440px-John_Maynard_Keynes.jpg) |
| George Soros | [george-soros.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/George_Soros_-_Festival_Economia_2012.JPG/440px-George_Soros_-_Festival_Economia_2012.JPG) |
| Ray Dalio | [ray-dalio.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Ray_Dalio_2017_%28cropped%29.jpg/440px-Ray_Dalio_2017_%28cropped%29.jpg) |
| Peter Lynch | [peter-lynch.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Peter_Lynch_%28cropped%29.jpg/440px-Peter_Lynch_%28cropped%29.jpg) |
| Howard Marks | [howard-marks.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Howard_Marks_%28investor%29.jpg/440px-Howard_Marks_%28investor%29.jpg) |
| Paul Tudor Jones | [paul-tudor-jones.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Paul_Tudor_Jones_at_the_Robin_Hood_Foundation.jpg/440px-Paul_Tudor_Jones_at_the_Robin_Hood_Foundation.jpg) |
| Mellody Hobson | [mellody-hobson.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Mellody_Hobson.jpg/440px-Mellody_Hobson.jpg) |
| Edwin Lefevre | [edwin-lefevre.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Edwin_Lef%C3%A8vre.jpg/440px-Edwin_Lef%C3%A8vre.jpg) |
| Robert Arnott | [robert-arnott.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Rob_Arnott.jpg/440px-Rob_Arnott.jpg) |
| Nicolas Darvas | [nicolas-darvas.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Nicolas_Darvas.jpg/440px-Nicolas_Darvas.jpg) |
| Jesse Livermore | [jesse-livermore.jpg](https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Press_photo_of_Jesse_Livermore_in_1940_%28cropped%29.jpg/440px-Press_photo_of_Jesse_Livermore_in_1940_%28cropped%29.jpg) |

## People without free Commons headshots

These authors don’t have suitable headshots on Wikimedia Commons. You’ll need to source images elsewhere (e.g. Getty, news sites, official sites):

- **Sir John Templeton** – [John Templeton Foundation media kit](https://www.templeton.org/news/media-kit) has official headshots
- **Ed Seykota** – No Commons image; try Market Wizards book cover or interviews
- **Alexander Elder** – [elder.com](https://www.elder.com/about) may have a photo
- **William J. O'Neil** – No Commons image; Investor’s Business Daily tributes
- **Philip Fisher** – No Commons image; older investor, few public photos
- **Victor Sperandeo** – No Commons image
- **Robert Olstein** – No Commons image
- **Ken Fisher** – No Commons image (avoid Fisher House Foundation Ken Fisher)
- **Larry Hite** – No Commons image; Market Wizards
- **Morgan Housel** – No Commons image; author of *The Psychology of Money*

## Suggested filenames when saving

Use these names so they match the app:

- `warren-buffett.jpg`
- `charlie-munger.jpg`
- `benjamin-graham.jpg`
- `john-maynard-keynes.jpg`
- `george-soros.jpg`
- `ray-dalio.jpg`
- `peter-lynch.jpg`
- `howard-marks.jpg`
- `paul-tudor-jones.jpg`
- `mellody-hobson.jpg`
- `edwin-lefevre.jpg`
- `robert-arnott.jpg`
- `nicolas-darvas.jpg`
- `jesse-livermore.jpg`

Save all files into: `public/headshots/`
