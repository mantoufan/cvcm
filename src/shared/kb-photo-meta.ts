import { PHOTO_ARTICLES, PHOTO_ARTICLE_TOOLS, type PhotoId } from "./kb-photo";
import { registerShelf, type KbMeta } from "./kb";
import { PHOTO_MINUTES, PHOTO_UPDATED } from "../locales/kb/meta-photo";

/**
 * Sources, links and dates of the photography articles. Only kb pages need them, so this module rides in the kb packs
 * (src/locales/packs/kb-*.ts) and registers itself with kb.ts instead of sitting in the entry chunk.
 */
const D = "2026-11-17";

const META: Record<PhotoId, Omit<KbMeta, "tools">> = {
  "exposure-triangle": {
    published: D,
    tutorials: ["remove-exif"],
    related: ["aperture-and-depth-of-field", "shutter-speed", "iso-and-noise", "backlit-photos"],
    sources: [
      { title: "Nikon: A Basic Look at the Basics of Exposure", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/a-basic-look-at-the-basics-of-exposure" },
      { title: "Nikon D3500 Digitutor: P, S, A, and M Modes", href: "https://imaging.nikon.com/imaging/support/digitutor/d3500/functions/shootingmodes.html" },
      { title: "Nikon: Understanding Auto ISO", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/understanding-auto-iso" },
      { title: "Apple Support: Use iPhone camera tools to set up your shot", href: "https://support.apple.com/guide/iphone/set-up-your-shot-iph3dc593597/ios" },
    ],
  },
  "aperture-and-depth-of-field": {
    published: D,
    tutorials: [],
    related: ["exposure-triangle", "focal-length", "portrait-photography-tips"],
    sources: [
      { title: "Fujifilm: Apertures and Depth-of-Field", href: "https://www.fujifilm-x.com/en-gb/learning-centre/apertures-and-depth-of-field/" },
      { title: "Fujifilm: Get Beautiful Bokeh", href: "https://www.fujifilm-x.com/en-gb/learning-centre/get-beautiful-bokeh/" },
      { title: "Nikon: What is Aperture?", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/what-is-aperture" },
      { title: "Apple Support: Use Portrait mode on your iPhone", href: "https://support.apple.com/en-us/102398" },
    ],
  },
  "shutter-speed": {
    published: D,
    tutorials: [],
    related: ["exposure-triangle", "iso-and-noise", "night-photography"],
    sources: [
      { title: "Nikon: Understanding Shutter Speed", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/understanding-shutter-speed" },
      { title: "Nikon: 10 Tips for Better Camera Panning", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/10-tips-for-better-camera-panning" },
      { title: "Fujifilm: Blurring Motion with Long Shutter Speeds", href: "https://www.fujifilm-x.com/en-gb/learning-centre/blurring-motion-with-long-shutter-speeds/" },
    ],
  },
  "iso-and-noise": {
    published: D,
    tutorials: ["remove-exif"],
    related: ["exposure-triangle", "shutter-speed", "night-photography"],
    sources: [
      { title: "ISO 12232:2019 Digital still cameras: exposure index and ISO speed ratings", href: "https://www.iso.org/standard/73758.html" },
      { title: "Fujifilm: Reducing Noise in Low Light Images", href: "https://www.fujifilm-x.com/en-gb/learning-centre/reducing-noise-in-low-light-images/" },
      { title: "Fujifilm: Using High ISO Settings in Low Light", href: "https://www.fujifilm-x.com/en-gb/learning-centre/using-high-iso-settings-in-low-light/" },
      { title: "Nikon: Understanding Auto ISO", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/understanding-auto-iso" },
      { title: "Google Pixel Camera Help: Take photos in low light or at night", href: "https://support.google.com/pixelcamera/answer/9708795?hl=en" },
    ],
  },
  "white-balance": {
    published: D,
    tutorials: [],
    related: ["exposure-triangle", "golden-hour", "food-photography"],
    sources: [
      { title: "Nikon: Setting White Balance", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/setting-white-balance" },
      { title: "Fujifilm: Take Control with White Balance Presets", href: "https://www.fujifilm-x.com/en-gb/learning-centre/take-control-with-white-balance-presets/" },
      { title: "Fujifilm: Get to Grips with Custom White Balance", href: "https://www.fujifilm-x.com/en-gb/learning-centre/get-to-grips-with-custom-white-balance/" },
    ],
  },
  "focal-length": {
    published: D,
    tutorials: ["crop-photo"],
    related: ["aperture-and-depth-of-field", "portrait-photography-tips", "selfie-tips", "photograph-the-moon"],
    sources: [
      { title: "Nikon: Understanding Focal Length", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/understanding-focal-length" },
      { title: "Fujifilm: Focal Lengths Demystified", href: "https://www.fujifilm-x.com/en-gb/learning-centre/focal-lengths-demystified/" },
      { title: "Fujifilm: Top Portrait Lenses", href: "https://www.fujifilm-x.com/en-gb/learning-centre/top-portrait-lenses/" },
    ],
  },
  "rule-of-thirds": {
    published: D,
    tutorials: ["crop-photo", "aspect-ratio"],
    related: ["photo-composition", "phone-photography", "portrait-photography-tips"],
    sources: [
      { title: "Fujifilm Learning Centre: The Rule of Thirds", href: "https://www.fujifilm-x.com/en-gb/learning-centre/the-rule-of-thirds/" },
      { title: "Nikon USA: 5 Easy Composition Guidelines", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/5-easy-composition-guidelines" },
      { title: "Fujifilm Learning Centre: The Basics of Composition", href: "https://www.fujifilm-x.com/en-gb/learning-centre/the-basics-of-composition/" },
      { title: "Pixel Camera Help: Change your Camera app settings (grid lines)", href: "https://support.google.com/pixelcamera/answer/2838995?hl=en" },
    ],
  },
  "photo-composition": {
    published: D,
    tutorials: ["crop-photo", "rotate-photo"],
    related: ["rule-of-thirds", "focal-length", "phone-photography", "golden-hour"],
    sources: [
      { title: "Fujifilm Learning Centre: Using Leading Lines", href: "https://www.fujifilm-x.com/en-gb/learning-centre/using-leading-lines/" },
      { title: "Fujifilm Learning Centre: The Basics of Composition", href: "https://www.fujifilm-x.com/en-gb/learning-centre/the-basics-of-composition/" },
      { title: "Fujifilm Learning Centre: Giving Images Depth", href: "https://www.fujifilm-x.com/en-gb/learning-centre/giving-images-depth/" },
      { title: "Nikon USA: 5 Easy Composition Guidelines", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/5-easy-composition-guidelines" },
    ],
  },
  "golden-hour": {
    published: D,
    tutorials: [],
    related: ["backlit-photos", "white-balance", "portrait-photography-tips", "night-photography"],
    sources: [
      { title: "Fujifilm Learning Centre: The Golden Hour and Blue Hour", href: "https://www.fujifilm-x.com/en-gb/learning-centre/the-golden-hour-and-blue-hour/" },
      { title: "NOAA Global Monitoring Laboratory: Solar Calculator", href: "https://gml.noaa.gov/grad/solcalc/" },
      { title: "National Weather Service: Definitions of Twilight", href: "https://www.weather.gov/fsd/twilight" },
      { title: "U.S. Naval Observatory: Sun and Moon Data for One Day", href: "https://aa.usno.navy.mil/data/RS_OneDay" },
    ],
  },
  "backlit-photos": {
    published: D,
    tutorials: [],
    related: ["golden-hour", "exposure-triangle", "portrait-photography-tips", "phone-photography"],
    sources: [
      { title: "Fujifilm Learning Centre: When to Use Exposure Compensation", href: "https://www.fujifilm-x.com/en-gb/learning-centre/when-to-use-exposure-compensation/" },
      { title: "Fujifilm Learning Centre: Get Creative With Flash Compensation", href: "https://www.fujifilm-x.com/en-gb/learning-centre/get-creative-with-flash-compensation/" },
      { title: "Fujifilm: Here Comes the Sun, a guide to photographing sunbeams", href: "https://www.fujifilm-x.com/en-ie/stories/here-comes-the-sun-a-guide-to-photographing-sunbeams/" },
      { title: "Pixel Camera Help: Take high quality photos (focus and exposure lock)", href: "https://support.google.com/pixelcamera/answer/14106982?hl=en" },
    ],
  },
  "how-to-pose-for-photos": {
    published: D,
    tutorials: [],
    related: ["portrait-photography-tips", "self-portrait-photography", "selfie-tips", "bridal-poses"],
    sources: [
      { title: "Canon Snapshot: Techniques for Posing and Directing Portrait Subjects", href: "https://snapshot.asia.canon/en/article/techniques-for-posing-and-directing-portrait-subjects" },
      { title: "Nikon USA: Take Better Portraits", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/take-better-portraits" },
      { title: "Nikon USA: Look Good in Pictures how-to series (press release)", href: "https://www.nikonusa.com/press-room/nikons-how-to-series-look-go" },
      { title: "Canon Snapshot: Portrait Photography Tips for Work and Play", href: "https://snapshot.asia.canon/en/article/portrait-photography-tips-for-work-and-play" },
    ],
  },
  "portrait-photography-tips": {
    published: D,
    tutorials: ["crop-photo"],
    related: ["how-to-pose-for-photos", "aperture-and-depth-of-field", "focal-length", "self-portrait-photography"],
    sources: [
      { title: "Canon SNAPSHOT: Portrait Photography: 3 Aperture Settings Favoured by Professional Photographers", href: "https://snapshot.canon-asia.com/article/eng/portrait-photography-3-aperture-settings-favoured-by-professional-photographers" },
      { title: "Nikon USA: Quick Tips for Taking Better Portraits", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/quick-tips-for-taking-better-portraits" },
      { title: "Apple iPhone User Guide: Take portraits with your iPhone camera", href: "https://support.apple.com/guide/iphone/take-portraits-iphd7d3a91a2/ios" },
    ],
  },
  "selfie-tips": {
    published: D,
    tutorials: ["crop-photo", "remove-exif"],
    related: ["self-portrait-photography", "how-to-pose-for-photos", "phone-photography", "focal-length"],
    sources: [
      { title: "Apple iPhone User Guide: Take a selfie with your iPhone camera", href: "https://support.apple.com/guide/iphone/take-a-selfie-iph1b88429a6/ios" },
      { title: "Apple Support: Use Portrait mode on your iPhone", href: "https://support.apple.com/en-us/102398" },
      { title: "Samsung Support: Take the best selfies with your Galaxy phone", href: "https://www.samsung.com/us/support/answer/ANS10002872/" },
    ],
  },
  "self-portrait-photography": {
    published: D,
    tutorials: ["crop-photo", "make-collage"],
    related: ["selfie-tips", "how-to-pose-for-photos", "aperture-and-depth-of-field", "solo-bridal-photoshoot"],
    sources: [
      { title: "Nikon USA: Have Fun Shooting Selfies (Self-Portrait) Photos", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/have-fun-shooting-selfies-self-portrait-photos" },
      { title: "Nikon USA: Remotely taking photographs", href: "https://www.nikonusa.com/learn-and-explore/c/products-and-innovation/remotely-taking-photographs" },
      { title: "Canon Snapshot: How to Capture a Windswept Hair Self-Portrait at Home", href: "https://snapshot.asia.canon/en/article/how-to-capture-a-windswept-hair-self-portrait-at-home" },
      { title: "Apple Support: Use iPhone camera tools to set up your shot", href: "https://support.apple.com/guide/iphone/iph3dc593597/ios" },
      { title: "Pixel Camera Help: Take a selfie on your Pixel phone or tablet", href: "https://support.google.com/pixelcamera/answer/9937027?hl=en" },
    ],
  },
  "solo-bridal-photoshoot": {
    published: D,
    tutorials: ["make-collage", "remove-exif"],
    related: ["bridal-poses", "pre-wedding-photoshoot", "self-portrait-photography", "golden-hour"],
    sources: [
      { title: "Canon Snapshot: Indoor Wedding Photography with Available Light: 3 Simple Techniques", href: "https://snapshot.asia.canon/en/article/indoor-wedding-photography-with-available-light-3-simple-techniques" },
      { title: "Nikon USA: Using the Highlight-Weighted Metering Mode", href: "https://www.nikonusa.com/learn-and-explore/c/products-and-innovation/using-the-highlight-weighted-metering-mode" },
      { title: "Nikon USA: Remotely taking photographs", href: "https://www.nikonusa.com/learn-and-explore/c/products-and-innovation/remotely-taking-photographs" },
      { title: "Apple Support: Use iPhone camera tools to set up your shot", href: "https://support.apple.com/guide/iphone/iph3dc593597/ios" },
      { title: "NOAA Global Monitoring Laboratory: Solar Calculator", href: "https://gml.noaa.gov/grad/solcalc/" },
    ],
  },
  "bridal-poses": {
    published: D,
    tutorials: ["crop-photo"],
    related: ["solo-bridal-photoshoot", "pre-wedding-photoshoot", "how-to-pose-for-photos"],
    sources: [
      { title: "Canon Snapshot: Staple Yet Brilliant Wedding Poses To Direct Nervous Clients", href: "https://snapshot.asia.canon/en/article/staple-yet-brilliant-wedding-poses-to-direct-nervous-clients" },
      { title: "Canon Snapshot: Techniques for Posing and Directing Portrait Subjects", href: "https://snapshot.asia.canon/en/article/techniques-for-posing-and-directing-portrait-subjects" },
      { title: "Canon Snapshot: Indoor Wedding Photography with Available Light: 3 Simple Techniques", href: "https://snapshot.asia.canon/en/article/indoor-wedding-photography-with-available-light-3-simple-techniques" },
      { title: "Nikon USA: Take Better Portraits", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/take-better-portraits" },
    ],
  },
  "pre-wedding-photoshoot": {
    published: D,
    tutorials: ["make-collage", "remove-exif"],
    related: ["solo-bridal-photoshoot", "bridal-poses", "golden-hour", "how-to-pose-for-photos"],
    sources: [
      { title: "Canon Snapshot: How to Handle a Camera-Shy Groom and Other Wedding Photography Tips", href: "https://snapshot.asia.canon/en/article/how-to-handle-a-camera-shy-groom-and-other-wedding-photography-tips" },
      { title: "Canon Snapshot: Staple Yet Brilliant Wedding Poses To Direct Nervous Clients", href: "https://snapshot.asia.canon/en/article/staple-yet-brilliant-wedding-poses-to-direct-nervous-clients" },
      { title: "Fujifilm Learning Centre: Photographing Your First Wedding", href: "https://www.fujifilm-x.com/en-gb/learning-centre/photographing-your-first-wedding/" },
      { title: "NOAA Global Monitoring Laboratory: Solar Calculator", href: "https://gml.noaa.gov/grad/solcalc/" },
    ],
  },
  "phone-photography": {
    published: D,
    tutorials: ["crop-photo", "remove-exif"],
    related: ["selfie-tips", "night-photography", "focal-length", "photo-composition"],
    sources: [
      { title: "Apple iPhone User Guide: Use iPhone camera tools to set up your shot", href: "https://support.apple.com/guide/iphone/set-up-your-shot-iph3dc593597/ios" },
      { title: "Apple iPhone User Guide: Take Night mode photos with your iPhone camera", href: "https://support.apple.com/guide/iphone/take-night-mode-photos-iph1a3c5b4c3/ios" },
      { title: "Pixel Camera Help: Take high quality photos on your Pixel phone or tablet", href: "https://support.google.com/pixelcamera/answer/14106982?hl=en" },
      { title: "Pixel Camera Help: Take photos in low light or at night on your Pixel phone or tablet", href: "https://support.google.com/pixelcamera/answer/9708795?hl=en" },
    ],
  },
  "night-photography": {
    published: D,
    tutorials: [],
    related: ["shutter-speed", "iso-and-noise", "photograph-the-moon", "golden-hour"],
    sources: [
      { title: "Nikon UK: 5 exposure settings to try for night-time photography", href: "https://www.nikon.co.uk/en_GB/learn-and-explore/magazine/tips-and-tricks/5-exposure-settings-to-try-for-night-time-photography--an-advanced-guide" },
      { title: "Nikon USA: Taking Pictures at Dusk and at Night", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/taking-pictures-at-dusk-and-at-night" },
      { title: "Canon SNAPSHOT: Nightscape Photography, Light Trails", href: "https://snapshot.canon-asia.com/article/eng/part-1-nightscape-photography-8211-light-trails" },
      { title: "Pixel Camera Help: Take photos in low light or at night on your Pixel phone or tablet", href: "https://support.google.com/pixelcamera/answer/9708795?hl=en" },
      { title: "Apple iPhone User Guide: Take Night mode photos with your iPhone camera", href: "https://support.apple.com/guide/iphone/take-night-mode-photos-iph1a3c5b4c3/ios" },
    ],
  },
  "photograph-the-moon": {
    published: D,
    tutorials: ["crop-photo"],
    related: ["night-photography", "focal-length", "phone-photography", "exposure-triangle"],
    sources: [
      { title: "NASA Science: Lunar Photography Guide", href: "https://science.nasa.gov/moon/photography-guide/" },
      { title: "NASA Science: How to Photograph the Moon", href: "https://science.nasa.gov/solar-system/moon/how-to-photograph-the-moon/" },
      { title: "NASA Science: Moon Phases", href: "https://science.nasa.gov/moon/moon-phases/" },
      { title: "NASA Science: Moon Facts", href: "https://science.nasa.gov/moon/facts/" },
      { title: "U.S. Naval Observatory: Sun and Moon Data for One Day", href: "https://aa.usno.navy.mil/data/RS_OneDay" },
    ],
  },
  "food-photography": {
    published: D,
    tutorials: ["crop-photo", "make-collage"],
    related: ["phone-photography", "white-balance", "product-photography", "photo-composition"],
    sources: [
      { title: "Canon SNAPSHOT: Tips for Your First Food Photography Shoot", href: "https://snapshot.canon-asia.com/article/eng/tips-for-your-first-food-photography-shoot" },
      { title: "Nikon UK: How to photograph restaurant food", href: "https://www.nikon.co.uk/en_GB/learn-and-explore/magazine/tips-and-tricks/how-to-photograph-restaurant-food" },
      { title: "Canon SNAPSHOT: Take Better Food Photos: 3 Simple Tips", href: "https://snapshot.canon-asia.com/article/eng/take-better-food-photos-3-simple-tips" },
    ],
  },
  "product-photography": {
    published: D,
    tutorials: ["remove-photo-background", "resize-image"],
    related: ["food-photography", "aperture-and-depth-of-field", "white-balance", "phone-photography"],
    sources: [
      { title: "Nikon USA: Bright Ideas: Tips and Techniques for Photographing Jewelry", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/bright-ideas-tips-and-techniques-for-photographing-jewelry" },
      { title: "Nikon USA: Transforming Plain White Seamless Paper into Colorful and Fun Backgrounds", href: "https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/transforming-plain-white-seamless-into-fun-backgrounds" },
      { title: "Canon EOS R7 Product Manual: Focus Bracketing", href: "https://cam.start.canon/en/C005/manual/html/UG-04_Shooting-1_0320.html" },
      { title: "Canon SNAPSHOT: Simple Product Photography: Flowers & Confectionery", href: "https://snapshot.canon-asia.com/article/eng/simple-product-photography-flowers-confectionery" },
    ],
  },
};

registerShelf("photo", {
  meta: Object.fromEntries(PHOTO_ARTICLES.map((id) => [id, { ...META[id], tools: [...(PHOTO_ARTICLE_TOOLS[id] ?? [])] }])) as Record<PhotoId, KbMeta>,
  updated: PHOTO_UPDATED,
  minutes: PHOTO_MINUTES,
});
