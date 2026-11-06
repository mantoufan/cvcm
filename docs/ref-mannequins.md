# Reference page mannequins

Line art on the reference pages comes from [wquguru/shisei](https://github.com/wquguru/shisei), tag `v0.4.1`
(commit `26522a708c77088eda4631327b15d8d05f6281c0`). Its images are dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required; the pages credit it anyway.

Shisei's NOTICE says its pose selection, numbering, names and categories follow the ai-pose-gallery catalog and are
credited, not licensed. So cv.cm does not reuse any of them: files are renamed by cv.cm entry and camera angle, and the
alt text comes from cv.cm's own copy. Pose ids appear here only as provenance.

| cv.cm entry | Shisei file stem | Angles used (Shisei view) |
|---|---|---|
| `sitting-pose` | `std_P012` | front, three-quarter (`diag`), side, above |
| `standing-pose` | `std_P016` | front, three-quarter (`diag`), side |
| `kneeling-pose` | `std_P037` | front, three-quarter (`diag`), side |

Only poses rated `general` were considered, and each view was checked by eye before use. Low-angle (`below`) views and
views whose stance did not match the rest of the set were left out.

Files are the original `images/line/w{300,600,900}` WebPs, unmodified. To add one, put it in `public/covers/ref/`,
upload it to s3.cv.cm `files/covers/ref/` (production reads `/covers/` from there), and add it to `REF_MANNEQUINS`.
