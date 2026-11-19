import { MASSAGE_ARTICLES, MASSAGE_ARTICLE_TOOLS, type MassageId } from "./kb-massage";
import { registerShelf, type KbMeta } from "./kb";
import { MASSAGE_MINUTES, MASSAGE_UPDATED } from "../locales/kb/meta-massage";

/**
 * Sources, links and dates of the massage articles. Only kb pages need them, so this module rides in the kb packs
 * (src/locales/packs/kb-*.ts) and registers itself with kb.ts instead of sitting in the entry chunk.
 */
const D = "2026-11-19";

const META: Record<MassageId, Omit<KbMeta, "tools">> = {
  "how-to-massage": {
    published: D,
    tutorials: [],
    related: ["when-not-to-massage", "back-massage", "foot-massage", "neck-and-shoulder-massage"],
    sources: [
      { title: "Massage Therapy: What You Need To Know — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
      { title: "Massage Therapy — Cleveland Clinic", href: "https://my.clevelandclinic.org/departments/wellness/integrative/treatments-services/massage-therapy" },
      { title: "Furlan AD et al. Massage for low-back pain. Cochrane Database of Systematic Reviews, 2015 (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8734598/" },
    ],
  },
  "when-not-to-massage": {
    published: D,
    tutorials: [],
    related: ["how-to-massage", "back-massage", "foot-massage"],
    sources: [
      { title: "Massage Therapy: What You Need To Know — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
      { title: "Massage Therapy — Cleveland Clinic", href: "https://my.clevelandclinic.org/departments/wellness/integrative/treatments-services/massage-therapy" },
      { title: "Deep vein thrombosis (DVT) — NHS", href: "https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/" },
      { title: "Furlan AD et al. Massage for low-back pain. Cochrane Database of Systematic Reviews, 2015 (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8734598/" },
      { title: "Credentials for the Massage Therapy Profession — American Massage Therapy Association", href: "https://www.amtamassage.org/state-regulations/credentials-massage-therapy-profession/" },
    ],
  },
  "acupressure-points": {
    published: D,
    tutorials: [],
    related: ["pressure-points-for-headache", "pressure-points-for-eye-strain", "foot-reflexology-chart", "when-not-to-massage"],
    sources: [
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region (WHO, 2008)", href: "https://iris.who.int/handle/10665/353407" },
      { title: "Stimulation of the wrist acupuncture point PC6 for preventing postoperative nausea and vomiting: a network meta-analysis (Cochrane Database of Systematic Reviews, 2025)", href: "https://pubmed.ncbi.nlm.nih.gov/40938065/" },
      { title: "The effectiveness of acupressure on relieving pain: a systematic review (Pain Management Nursing, 2014)", href: "https://pubmed.ncbi.nlm.nih.gov/23415783/" },
      { title: "Acupuncture: What You Need To Know (NCCIH)", href: "https://www.nccih.nih.gov/health/acupuncture-what-you-need-to-know" },
    ],
  },
  "pressure-points-for-headache": {
    published: D,
    tutorials: [],
    related: ["acupressure-points", "neck-and-shoulder-massage", "scalp-massage", "when-not-to-massage"],
    sources: [
      { title: "Tension headaches (NHS)", href: "https://www.nhs.uk/conditions/tension-headaches/" },
      { title: "Headaches (NHS)", href: "https://www.nhs.uk/conditions/headaches/" },
      { title: "Headaches: What You Need To Know (NCCIH)", href: "https://www.nccih.nih.gov/health/headaches-what-you-need-to-know" },
      { title: "Effect of acupressure and trigger points in treating headache: a randomized controlled trial (American Journal of Chinese Medicine, 2010)", href: "https://pubmed.ncbi.nlm.nih.gov/20128040/" },
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region (WHO, 2008)", href: "https://iris.who.int/handle/10665/353407" },
    ],
  },
  "pressure-points-for-eye-strain": {
    published: D,
    tutorials: [],
    related: ["acupressure-points", "pressure-points-for-headache", "facial-massage", "neck-and-shoulder-massage"],
    sources: [
      { title: "Computers, Digital Devices, and Eye Strain (American Academy of Ophthalmology)", href: "https://www.aao.org/eye-health/tips-prevention/computer-usage" },
      { title: "Eye Strain and Sleepy Eyes: How to Prevent Eye Discomfort (American Academy of Ophthalmology)", href: "https://www.aao.org/eye-health/diseases/what-is-eye-strain" },
      { title: "Efficacy of Chinese eye exercises on reducing accommodative lag in school-aged children: a randomized controlled trial (PLoS One, 2015)", href: "https://pubmed.ncbi.nlm.nih.gov/25742161/" },
      { title: "Chinese eye exercises and myopia development in school age children: a nested case-control study (Scientific Reports, 2016)", href: "https://pubmed.ncbi.nlm.nih.gov/27329615/" },
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region (WHO, 2008)", href: "https://iris.who.int/handle/10665/353407" },
    ],
  },
  "foot-reflexology-chart": {
    published: D,
    tutorials: [],
    related: ["foot-massage", "acupressure-points", "when-not-to-massage"],
    sources: [
      { title: "Reflexology — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/reflexology" },
      { title: "Ernst E. Is reflexology an effective intervention? A systematic review of randomised controlled trials. Med J Aust, 2009 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/19740047/" },
      { title: "Reflexology — Cancer Research UK", href: "https://www.cancerresearchuk.org/about-cancer/treatment/complementary-alternative-therapies/individual-therapies/reflexology" },
      { title: "What is reflexology? — Association of Reflexologists (UK)", href: "https://www.aor.org.uk/about-us/what-is-reflexology/" },
    ],
  },
  "foot-massage": {
    published: D,
    tutorials: [],
    related: ["foot-reflexology-chart", "how-to-massage", "when-not-to-massage", "tennis-ball-massage"],
    sources: [
      { title: "Diabetes - taking care of your feet — MedlinePlus Medical Encyclopedia", href: "https://medlineplus.gov/ency/patientinstructions/000081.htm" },
      { title: "Plantar fasciitis — NHS", href: "https://www.nhs.uk/conditions/plantar-fasciitis/" },
      { title: "Reflexology — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/reflexology" },
      { title: "Deep vein thrombosis (DVT) — NHS", href: "https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/" },
    ],
  },
  "hand-massage": {
    published: D,
    tutorials: [],
    related: ["how-to-massage", "acupressure-points", "foot-massage", "when-not-to-massage"],
    sources: [
      { title: "Carpal tunnel syndrome (NHS)", href: "https://www.nhs.uk/conditions/carpal-tunnel-syndrome/" },
      { title: "Wrist pain (NHS)", href: "https://www.nhs.uk/symptoms/hand-pain/wrist-pain/" },
      { title: "Rheumatoid arthritis in upper limbs benefits from moderate pressure massage therapy (Complementary Therapies in Clinical Practice, 2013)", href: "https://pubmed.ncbi.nlm.nih.gov/23561068/" },
      { title: "Massage Therapy: What You Need To Know (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region (WHO, 2008)", href: "https://iris.who.int/handle/10665/353407" },
    ],
  },
  "neck-and-shoulder-massage": {
    published: D,
    tutorials: [],
    related: ["pressure-points-for-headache", "tennis-ball-massage", "back-massage", "when-not-to-massage"],
    sources: [
      { title: "Neck pain — NHS", href: "https://www.nhs.uk/conditions/neck-pain/" },
      { title: "Massage Therapy: What You Need To Know — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
      { title: "Lee H et al. Massage for neck pain contrasted against standard (non-surgical) treatment: a systematic review update. J Bodyw Mov Ther, 2024 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/39593614/" },
      { title: "Meningitis — NHS", href: "https://www.nhs.uk/conditions/meningitis/" },
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region — World Health Organization, 2008 (WHO IRIS)", href: "https://iris.who.int/handle/10665/353407" },
    ],
  },
  "back-massage": {
    published: D,
    tutorials: [],
    related: ["how-to-massage", "when-not-to-massage", "neck-and-shoulder-massage", "tennis-ball-massage"],
    sources: [
      { title: "Back pain — NHS", href: "https://www.nhs.uk/conditions/back-pain/" },
      { title: "Furlan AD et al. Massage for low-back pain. Cochrane Database of Systematic Reviews, 2015 (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8734598/" },
      { title: "Massage Therapy: What You Need To Know — National Center for Complementary and Integrative Health (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
    ],
  },
  "facial-massage": {
    published: D,
    tutorials: [],
    related: ["how-to-use-gua-sha", "scalp-massage", "pressure-points-for-eye-strain"],
    sources: [
      { title: "Temporomandibular disorder (TMD) — NHS", href: "https://www.nhs.uk/conditions/temporomandibular-disorder-tmd/" },
      { title: "Teeth grinding (bruxism) — NHS", href: "https://www.nhs.uk/conditions/teeth-grinding/" },
      { title: "Okuda I et al. Objective analysis of the effectiveness of facial massage using breakthrough computed tomographic technology: a preliminary pilot study. Skin Res Technol, 2022 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/35416349/" },
      { title: "Porcheron A et al. Evaluation of a daily facial massage on perceived sleep quality and well-being: a pilot study. Int J Cosmet Sci, 2024 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/38561643/" },
      { title: "Unilateral platysma muscle rupture as an effect of using a hard wooden block for facial massage. Arch Plast Surg, 2024 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/38425863/" },
    ],
  },
  "scalp-massage": {
    published: D,
    tutorials: [],
    related: ["pressure-points-for-headache", "facial-massage", "neck-and-shoulder-massage"],
    sources: [
      { title: "Koyama T et al. Standardized scalp massage results in increased hair thickness by inducing stretching forces to dermal papilla cells in the subcutaneous tissue. Eplasty, 2016 (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4740347/" },
      { title: "Kim IH et al. The effect of a scalp massage on stress hormone, blood pressure, and heart rate of healthy female. J Phys Ther Sci, 2016 (PubMed)", href: "https://pubmed.ncbi.nlm.nih.gov/27821918/" },
      { title: "Hair loss — NHS", href: "https://www.nhs.uk/conditions/hair-loss/" },
      { title: "Tension-type headaches — NHS", href: "https://www.nhs.uk/conditions/tension-headaches/" },
      { title: "WHO Standard Acupuncture Point Locations in the Western Pacific Region — World Health Organization, 2008 (WHO IRIS)", href: "https://iris.who.int/handle/10665/353407" },
    ],
  },
  "how-to-use-gua-sha": {
    published: D,
    tutorials: [],
    related: ["facial-massage", "neck-and-shoulder-massage", "when-not-to-massage"],
    sources: [
      { title: "Gua Sha: What It Is and How To Do It (Cleveland Clinic)", href: "https://health.clevelandclinic.org/why-gua-sha-might-be-good-for-you" },
      { title: "Braun M et al. Effectiveness of traditional Chinese gua sha therapy in patients with chronic neck pain: a randomized controlled trial. Pain Med 2011", href: "https://pubmed.ncbi.nlm.nih.gov/21276190/" },
      { title: "Nielsen A et al. The effect of Gua Sha treatment on the microcirculation of surface tissue: a pilot study in healthy subjects. Explore 2007", href: "https://pubmed.ncbi.nlm.nih.gov/17905355/" },
    ],
  },
  "how-to-use-a-massage-gun": {
    published: D,
    tutorials: [],
    related: ["foam-rolling", "tennis-ball-massage", "when-not-to-massage"],
    sources: [
      { title: "Therabody: Product Safety and Precautions (Theragun precautions and contraindications)", href: "https://www.therabody.com/pages/precautions" },
      { title: "Try a Massage Gun for Relieving Aches and Pains (Cleveland Clinic)", href: "https://health.clevelandclinic.org/are-massage-guns-for-percussive-therapy-worth-it" },
      { title: "Konrad A et al. The acute effects of a percussive massage treatment with a Hypervolt device on plantar flexor muscles' range of motion and performance. J Sports Sci Med 2020", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7675623/" },
      { title: "Under the Gun: Percussive Massage Therapy and Physical and Perceptual Recovery in Active Adults. J Athl Train 2024", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10976339/" },
      { title: "Chen J et al. Rhabdomyolysis after the use of percussion massage gun: a case report. Phys Ther 2021", href: "https://pubmed.ncbi.nlm.nih.gov/33156927/" },
    ],
  },
  "foam-rolling": {
    published: D,
    tutorials: [],
    related: ["tennis-ball-massage", "how-to-use-a-massage-gun", "back-massage"],
    sources: [
      { title: "Should You Try Foam Rolling? (Cleveland Clinic)", href: "https://health.clevelandclinic.org/foam-rolling" },
      { title: "Wilke J et al. Acute effects of foam rolling on range of motion in healthy adults: a systematic review with multilevel meta-analysis. Sports Med 2020", href: "https://pubmed.ncbi.nlm.nih.gov/31628662/" },
      { title: "Wiewelhove T et al. A meta-analysis of the effects of foam rolling on performance and recovery. Front Physiol 2019", href: "https://www.frontiersin.org/articles/10.3389/fphys.2019.00376/full" },
      { title: "Chaudhry H et al. Three-dimensional mathematical model for deformation of human fasciae in manual therapy. J Am Osteopath Assoc 2008", href: "https://pubmed.ncbi.nlm.nih.gov/18723456/" },
    ],
  },
  "tennis-ball-massage": {
    published: D,
    tutorials: [],
    related: ["neck-and-shoulder-massage", "foam-rolling", "foot-massage", "back-massage"],
    sources: [
      { title: "For Relief, Pull the Trigger on a Trigger Point Massage (Cleveland Clinic)", href: "https://health.clevelandclinic.org/trigger-point-massage" },
      { title: "Massage Rollers and More: How to Ease Neck, Back and Body Pain with Simple Tools (Cleveland Clinic)", href: "https://health.clevelandclinic.org/massage-rollers-and-more-how-to-ease-neck-and-back-pain-with-simple-tools" },
      { title: "Quintner JL, Bove GM, Cohen ML. A critical evaluation of the trigger point phenomenon. Rheumatology 2015", href: "https://pubmed.ncbi.nlm.nih.gov/25477053/" },
      { title: "Massage Therapy: What You Need To Know (NCCIH)", href: "https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know" },
    ],
  },
};

registerShelf("massage", {
  meta: Object.fromEntries(MASSAGE_ARTICLES.map((id) => [id, { ...META[id], tools: [...(MASSAGE_ARTICLE_TOOLS[id] ?? [])] }])) as Record<MassageId, KbMeta>,
  updated: MASSAGE_UPDATED,
  minutes: MASSAGE_MINUTES,
});
