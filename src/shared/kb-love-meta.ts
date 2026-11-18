import { LOVE_ARTICLES, LOVE_ARTICLE_QUIZZES, type LoveId } from "./kb-love";
import { registerShelf, type KbMeta } from "./kb";
import { LOVE_MINUTES, LOVE_UPDATED } from "../locales/kb/meta-love";

/**
 * Sources, links, tests and dates of the relationships articles. Only kb pages need them, so this module rides in the kb packs
 * (src/locales/packs/kb-*.ts) and registers itself with kb.ts instead of sitting in the entry chunk.
 */
const D = "2026-11-18";

const META: Record<LoveId, Omit<KbMeta, "tools" | "tutorials" | "quizzes">> = {
  "what-is-love-bombing": {
    published: D,
    related: ["red-flags-in-a-relationship", "gaslighting-in-relationships", "what-is-breadcrumbing", "attachment-styles"],
    sources: [
      { title: "Signs of love bombing (love is respect)", href: "https://www.loveisrespect.org/resources/signs-of-love-bombing/" },
      { title: "What Is Love Bombing? 7 Signs To Look For (Cleveland Clinic)", href: "https://health.clevelandclinic.org/love-bombing" },
      { title: "Strutzenberg et al. (2017), Love-bombing: A Narcissistic Approach to Relationship Formation, Discovery (University of Arkansas)", href: "https://scholarworks.uark.edu/discoverymag/vol18/iss1/14/" },
      { title: "Getting help for domestic violence and abuse (NHS)", href: "https://www.nhs.uk/live-well/getting-help-for-domestic-violence/" },
    ],
  },
  "what-is-breadcrumbing": {
    published: D,
    related: ["what-is-love-bombing", "red-flags-in-a-relationship", "attachment-styles"],
    sources: [
      { title: "Navarro et al. (2020), Psychological Correlates of Ghosting and Breadcrumbing Experiences: A Preliminary Study among Adults, International Journal of Environmental Research and Public Health", href: "https://doi.org/10.3390/ijerph17031116" },
      { title: "How To Identify and Address Breadcrumbing (Cleveland Clinic)", href: "https://health.clevelandclinic.org/breadcrumbing" },
    ],
  },
  "silent-treatment": {
    published: D,
    related: ["gaslighting-in-relationships", "how-to-make-up-after-a-fight", "attachment-styles", "red-flags-in-a-relationship"],
    sources: [
      { title: "The Four Horsemen: Stonewalling (The Gottman Institute)", href: "https://www.gottman.com/blog/the-four-horsemen-stonewalling/" },
      { title: "The Four Horsemen: Criticism, Contempt, Defensiveness, and Stonewalling (The Gottman Institute)", href: "https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/" },
      { title: "Williams (2007), Ostracism, Annual Review of Psychology", href: "https://doi.org/10.1146/annurev.psych.58.110405.085641" },
      { title: "The Silent Treatment: Causes and Coping (Cleveland Clinic)", href: "https://health.clevelandclinic.org/silent-treatment" },
    ],
  },
  "gaslighting-in-relationships": {
    published: D,
    related: ["silent-treatment", "red-flags-in-a-relationship", "what-is-love-bombing"],
    sources: [
      { title: "What is Gaslighting? (The National Domestic Violence Hotline)", href: "https://www.thehotline.org/resources/what-is-gaslighting/" },
      { title: "Sweet (2019), The Sociology of Gaslighting, American Sociological Review", href: "https://doi.org/10.1177/0003122419874843" },
      { title: "Getting help for domestic violence and abuse (NHS)", href: "https://www.nhs.uk/live-well/getting-help-for-domestic-violence/" },
    ],
  },
  "red-flags-in-a-relationship": {
    published: D,
    related: ["what-is-love-bombing", "gaslighting-in-relationships", "silent-treatment", "mixed-signals"],
    sources: [
      { title: "Warning Signs of Abuse (The National Domestic Violence Hotline)", href: "https://www.thehotline.org/identify-abuse/domestic-abuse-warning-signs/" },
      { title: "Warning signs of dating abuse (love is respect)", href: "https://www.loveisrespect.org/dating-basics-for-healthy-relationships/warning-signs-of-abuse/" },
      { title: "The Four Horsemen: Criticism, Contempt, Defensiveness, and Stonewalling (The Gottman Institute)", href: "https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/" },
      { title: "An Introduction to Emotional Bids and Trust (The Gottman Institute)", href: "https://www.gottman.com/blog/an-introduction-to-emotional-bids-and-trust/" },
    ],
  },
  "attachment-styles": {
    published: D,
    related: ["silent-treatment", "what-is-breadcrumbing", "mixed-signals", "how-to-make-up-after-a-fight"],
    sources: [
      { title: "Hazan and Shaver (1987), Romantic love conceptualized as an attachment process, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.52.3.511" },
      { title: "A Brief Overview of Adult Attachment Theory and Research (R. Chris Fraley, University of Illinois)", href: "https://labs.psychology.illinois.edu/~rcfraley/attachment.htm" },
      { title: "Attachment theory (APA Dictionary of Psychology)", href: "https://dictionary.apa.org/attachment-theory" },
    ],
  },
  "signs-he-likes-you": {
    published: D,
    related: ["signs-she-likes-you", "signs-someone-likes-you-over-text", "mixed-signals", "how-to-confess-your-feelings"],
    sources: [
      { title: "Montoya and Insko (2008). Toward a more complete understanding of the reciprocity of liking effect. European Journal of Social Psychology", href: "https://doi.org/10.1002/ejsp.431" },
      { title: "Perilloux, Easton and Buss (2012). The misperception of sexual interest. Psychological Science", href: "https://doi.org/10.1177/0956797611424162" },
      { title: "Chang et al. (2020). Body sway predicts romantic interest in speed dating. Social Cognitive and Affective Neuroscience (PMC)", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7812630/" },
      { title: "The Gottman Institute: Want to improve your relationship? Start paying more attention to bids", href: "https://www.gottman.com/blog/want-to-improve-your-relationship-start-paying-more-attention-to-bids/" },
    ],
  },
  "signs-she-likes-you": {
    published: D,
    related: ["signs-he-likes-you", "what-girls-mean-when-they-say", "how-to-ask-someone-out", "rejected-after-confessing"],
    sources: [
      { title: "Abbey (1982). Sex differences in attributions for friendly behavior: Do males misperceive females' friendliness? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.42.5.830" },
      { title: "Perilloux, Easton and Buss (2012). The misperception of sexual interest. Psychological Science", href: "https://doi.org/10.1177/0956797611424162" },
      { title: "Hall, Carter, Cody and Albright (2010). Individual differences in the communication of romantic interest: Development of the Flirting Styles Inventory. Communication Quarterly", href: "https://doi.org/10.1080/01463373.2010.524874" },
      { title: "love is respect: Understanding consent in relationships", href: "https://www.loveisrespect.org/everyone-deserves-a-healthy-relationship/understand-consent/" },
    ],
  },
  "mixed-signals": {
    published: D,
    related: ["what-is-breadcrumbing", "attachment-styles", "talking-stage", "what-guys-mean-when-they-say"],
    sources: [
      { title: "The Gottman Institute: Stable instability in relationships, an interview with Amir Levine (part II)", href: "https://www.gottman.com/blog/stable-instability-relationships-interview-amir-levine-part-ii/" },
      { title: "Cleveland Clinic: How to identify and address breadcrumbing", href: "https://health.clevelandclinic.org/breadcrumbing" },
      { title: "Cleveland Clinic: Situationships, what they are and 5 signs you're in one", href: "https://health.clevelandclinic.org/what-is-a-situationship" },
      { title: "Eastwick, Finkel, Mochon and Ariely (2007). Selective versus unselective romantic desire: Not all reciprocity is created equal. Psychological Science", href: "https://doi.org/10.1111/j.1467-9280.2007.01897.x" },
    ],
  },
  "signs-someone-likes-you-over-text": {
    published: D,
    related: ["how-to-text-your-crush", "signs-he-likes-you", "signs-she-likes-you", "mixed-signals"],
    sources: [
      { title: "Kruger, Epley, Parker and Ng (2005). Egocentrism over e-mail: Can we communicate as well as we think? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.89.6.925" },
      { title: "Ireland et al. (2011). Language style matching predicts relationship initiation and stability. Psychological Science", href: "https://doi.org/10.1177/0956797610392928" },
      { title: "Patel, Mahar and Webster (2022). Adult romantic attachment, electronic messaging, and relationship quality. Cyberpsychology, Behavior, and Social Networking", href: "https://doi.org/10.1089/cyber.2021.0060" },
      { title: "The Gottman Institute: Want to improve your relationship? Start paying more attention to bids", href: "https://www.gottman.com/blog/want-to-improve-your-relationship-start-paying-more-attention-to-bids/" },
    ],
  },
  "what-girls-mean-when-they-say": {
    published: D,
    related: ["what-guys-mean-when-they-say", "signs-she-likes-you", "rejected-after-confessing", "signs-someone-likes-you-over-text"],
    sources: [
      { title: "Kruger, Epley, Parker and Ng (2005). Egocentrism over e-mail: Can we communicate as well as we think? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.89.6.925" },
      { title: "Joel, Teper and MacDonald (2014). People overestimate their willingness to reject potential romantic partners by overlooking their concern for other people. Psychological Science", href: "https://doi.org/10.1177/0956797614552828" },
      { title: "love is respect: Understanding consent in relationships", href: "https://www.loveisrespect.org/everyone-deserves-a-healthy-relationship/understand-consent/" },
    ],
  },
  "what-guys-mean-when-they-say": {
    published: D,
    related: ["what-girls-mean-when-they-say", "signs-he-likes-you", "mixed-signals", "what-is-breadcrumbing"],
    sources: [
      { title: "Kruger, Epley, Parker and Ng (2005). Egocentrism over e-mail: Can we communicate as well as we think? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.89.6.925" },
      { title: "Joel, Teper and MacDonald (2014). People overestimate their willingness to reject potential romantic partners by overlooking their concern for other people. Psychological Science", href: "https://doi.org/10.1177/0956797614552828" },
      { title: "Cleveland Clinic: Situationships, what they are and 5 signs you're in one", href: "https://health.clevelandclinic.org/what-is-a-situationship" },
      { title: "Cleveland Clinic: How to identify and address breadcrumbing", href: "https://health.clevelandclinic.org/breadcrumbing" },
    ],
  },
  "talking-stage": {
    published: D,
    related: ["mixed-signals", "what-is-breadcrumbing", "how-to-ask-someone-out", "how-to-confess-your-feelings"],
    sources: [
      { title: "Situationship (Cambridge Dictionary)", href: "https://dictionary.cambridge.org/dictionary/english/situationship" },
      { title: "Hall (2018), How many hours does it take to make a friend? Journal of Social and Personal Relationships", href: "https://doi.org/10.1177/0265407518761225" },
      { title: "Dating 101: Getting on the same page as your partner (love is respect)", href: "https://www.loveisrespect.org/dating-basics-for-healthy-relationships/dating-101/" },
      { title: "Turn Towards Instead of Away (The Gottman Institute)", href: "https://www.gottman.com/blog/turn-toward-instead-of-away/" },
    ],
  },
  "how-to-text-your-crush": {
    published: D,
    related: ["signs-someone-likes-you-over-text", "how-to-ask-someone-out", "talking-stage"],
    sources: [
      { title: "Huang et al. (2017), It doesn't hurt to ask: Question-asking increases liking, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/pspi0000097" },
      { title: "Boothby et al. (2018), The liking gap in conversations: Do people like us more than we think? Psychological Science", href: "https://doi.org/10.1177/0956797618783714" },
      { title: "How to set boundaries (love is respect)", href: "https://www.loveisrespect.org/everyone-deserves-a-healthy-relationship/how-to-set-boundaries/" },
    ],
  },
  "how-to-confess-your-feelings": {
    published: D,
    related: ["signs-he-likes-you", "signs-she-likes-you", "rejected-after-confessing", "talking-stage"],
    sources: [
      { title: "Baumeister, Wotman and Stillwell (1993), Unrequited love: On heartbreak, anger, guilt, scriptlessness, and humiliation, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.64.3.377" },
      { title: "Understand consent (love is respect)", href: "https://www.loveisrespect.org/everyone-deserves-a-healthy-relationship/understand-consent/" },
      { title: "Boothby et al. (2018), The liking gap in conversations: Do people like us more than we think? Psychological Science", href: "https://doi.org/10.1177/0956797618783714" },
    ],
  },
  "rejected-after-confessing": {
    published: D,
    related: ["how-to-confess-your-feelings", "how-to-get-over-a-breakup", "what-girls-mean-when-they-say"],
    sources: [
      { title: "Eisenberger, Lieberman and Williams (2003), Does rejection hurt? An fMRI study of social exclusion, Science", href: "https://doi.org/10.1126/science.1089134" },
      { title: "Baumeister, Wotman and Stillwell (1993), Unrequited love: On heartbreak, anger, guilt, scriptlessness, and humiliation, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.64.3.377" },
      { title: "Raising low self-esteem (NHS)", href: "https://www.nhs.uk/mental-health/self-help/tips-and-support/raise-low-self-esteem/" },
    ],
  },
  "how-to-ask-someone-out": {
    published: D,
    related: ["how-to-text-your-crush", "first-date-tips", "signs-someone-likes-you-over-text"],
    sources: [
      { title: "Flynn and Lake (2008), If you need help, just ask: Underestimating compliance with direct requests for help, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.95.1.128" },
      { title: "Things to think about when online dating (love is respect)", href: "https://www.loveisrespect.org/resources/things-to-think-about-when-online-dating/" },
      { title: "What to know about romance scams (US Federal Trade Commission)", href: "https://consumer.ftc.gov/articles/what-know-about-romance-scams" },
    ],
  },
  "first-date-tips": {
    published: D,
    related: ["how-to-ask-someone-out", "what-to-text-after-a-first-date", "red-flags-in-a-relationship", "what-is-love-bombing"],
    sources: [
      { title: "Huang et al. (2017), It doesn't hurt to ask: Question-asking increases liking, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/pspi0000097" },
      { title: "Aron et al. (1997), The experimental generation of interpersonal closeness, Personality and Social Psychology Bulletin", href: "https://doi.org/10.1177/0146167297234003" },
      { title: "Boothby et al. (2018), The liking gap in conversations: Do people like us more than we think? Psychological Science", href: "https://doi.org/10.1177/0956797618783714" },
      { title: "Things to think about when online dating (love is respect)", href: "https://www.loveisrespect.org/resources/things-to-think-about-when-online-dating/" },
      { title: "Understand consent (love is respect)", href: "https://www.loveisrespect.org/everyone-deserves-a-healthy-relationship/understand-consent/" },
    ],
  },
  "what-to-text-after-a-first-date": {
    published: D,
    related: ["first-date-tips", "being-ghosted", "what-is-love-bombing", "talking-stage"],
    sources: [
      { title: "Kumar and Epley (2018), Undervaluing gratitude: Expressers misunderstand the consequences of showing appreciation, Psychological Science", href: "https://doi.org/10.1177/0956797618772506" },
      { title: "Boothby et al. (2018), The liking gap in conversations: Do people like us more than we think? Psychological Science", href: "https://doi.org/10.1177/0956797618783714" },
    ],
  },
  "how-to-get-your-ex-back": {
    published: D,
    related: ["no-contact-rule", "should-you-get-back-together", "how-to-get-over-a-breakup", "red-flags-in-a-relationship"],
    sources: [
      { title: "Dailey et al. (2009), On-again/off-again dating relationships: How are they different from other dating relationships? Personal Relationships", href: "https://doi.org/10.1111/j.1475-6811.2009.01208.x" },
      { title: "loveisrespect: On again / off again relationships", href: "https://www.loveisrespect.org/resources/on-again-off-again-relationships/" },
      { title: "The Gottman Institute: The Four Horsemen: Criticism, Contempt, Defensiveness, and Stonewalling", href: "https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/" },
      { title: "loveisrespect: Should we break up?", href: "https://www.loveisrespect.org/resources/should-we-break-up/" },
    ],
  },
  "no-contact-rule": {
    published: D,
    related: ["how-to-get-over-a-breakup", "how-to-get-your-ex-back", "being-ghosted"],
    sources: [
      { title: "Marshall (2012), Facebook surveillance of former romantic partners: Associations with postbreakup recovery and personal growth. Cyberpsychology, Behavior, and Social Networking", href: "https://doi.org/10.1089/cyber.2012.0125" },
      { title: "NHS: Grief after bereavement or loss", href: "https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/grief-bereavement-loss/" },
      { title: "loveisrespect: Should we break up?", href: "https://www.loveisrespect.org/resources/should-we-break-up/" },
    ],
  },
  "should-you-get-back-together": {
    published: D,
    related: ["how-to-get-your-ex-back", "red-flags-in-a-relationship", "how-to-make-up-after-a-fight", "attachment-styles"],
    sources: [
      { title: "Dailey et al. (2009), On-again/off-again dating relationships: How are they different from other dating relationships? Personal Relationships", href: "https://doi.org/10.1111/j.1475-6811.2009.01208.x" },
      { title: "loveisrespect: On again / off again relationships", href: "https://www.loveisrespect.org/resources/on-again-off-again-relationships/" },
      { title: "The Gottman Institute: The Four Horsemen: Criticism, Contempt, Defensiveness, and Stonewalling", href: "https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/" },
    ],
  },
  "how-to-get-over-a-breakup": {
    published: D,
    related: ["no-contact-rule", "being-ghosted", "should-you-get-back-together"],
    sources: [
      { title: "NHS: Grief after bereavement or loss", href: "https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/grief-bereavement-loss/" },
      { title: "Kross et al. (2011), Social rejection shares somatosensory representations with physical pain. PNAS", href: "https://doi.org/10.1073/pnas.1102693108" },
      { title: "Slotter, Gardner and Finkel (2010), Who am I without you? The influence of romantic breakup on the self-concept. Personality and Social Psychology Bulletin", href: "https://doi.org/10.1177/0146167209352250" },
      { title: "Larson and Sbarra (2015), Participating in research on romantic breakups promotes emotional recovery via changes in self-concept clarity. Social Psychological and Personality Science", href: "https://doi.org/10.1177/1948550614563085" },
      { title: "Marshall (2012), Facebook surveillance of former romantic partners: Associations with postbreakup recovery and personal growth. Cyberpsychology, Behavior, and Social Networking", href: "https://doi.org/10.1089/cyber.2012.0125" },
    ],
  },
  "being-ghosted": {
    published: D,
    related: ["what-is-breadcrumbing", "mixed-signals", "how-to-get-over-a-breakup", "silent-treatment"],
    sources: [
      { title: "The Gottman Institute: Ghosting: The Silent Breakup", href: "https://www.gottman.com/blog/ghosting-the-silent-breakup/" },
      { title: "LeFebvre et al. (2019), Ghosting in emerging adults' romantic relationships: The digital dissolution disappearance strategy. Imagination, Cognition and Personality", href: "https://doi.org/10.1177/0276236618820519" },
      { title: "Williams (2007), Ostracism. Annual Review of Psychology", href: "https://doi.org/10.1146/annurev.psych.58.110405.085641" },
    ],
  },
  "how-to-break-up-with-someone": {
    published: D,
    related: ["being-ghosted", "no-contact-rule", "red-flags-in-a-relationship", "how-to-get-over-a-breakup"],
    sources: [
      { title: "The Gottman Institute: How to Break Up with Someone", href: "https://www.gottman.com/blog/how-to-break-up/" },
      { title: "loveisrespect: Should we break up?", href: "https://www.loveisrespect.org/resources/should-we-break-up/" },
    ],
  },
  "long-distance-relationship": {
    published: D,
    related: ["attachment-styles", "how-to-make-up-after-a-fight", "emotional-value", "relationship-slump"],
    sources: [
      { title: "Jiang and Hancock (2013), Absence Makes the Communication Grow Fonder, Journal of Communication", href: "https://doi.org/10.1111/jcom.12029" },
      { title: "Kelmer et al. (2013), Relationship Quality, Commitment, and Stability in Long-Distance Relationships, Family Process", href: "https://doi.org/10.1111/j.1545-5300.2012.01418.x" },
      { title: "Turn Towards Instead of Away (The Gottman Institute)", href: "https://www.gottman.com/blog/turn-toward-instead-of-away/" },
    ],
  },
  "how-to-make-up-after-a-fight": {
    published: D,
    related: ["how-to-apologize-to-your-partner", "silent-treatment", "emotional-value", "red-flags-in-a-relationship"],
    sources: [
      { title: "The Four Horsemen: Criticism, Contempt, Defensiveness, and Stonewalling (The Gottman Institute)", href: "https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/" },
      { title: "R is for Repair (The Gottman Institute)", href: "https://www.gottman.com/blog/r-is-for-repair/" },
      { title: "How to Fight Smarter: Soften Your Start-Up (The Gottman Institute)", href: "https://www.gottman.com/blog/softening-startup/" },
      { title: "National Domestic Violence Hotline (US)", href: "https://www.thehotline.org/" },
    ],
  },
  "how-to-apologize-to-your-partner": {
    published: D,
    related: ["how-to-make-up-after-a-fight", "emotional-value", "gaslighting-in-relationships"],
    sources: [
      { title: "The 6 elements of an effective apology, according to science (Ohio State University News)", href: "https://news.osu.edu/the-6-elements-of-an-effective-apology-according-to-science/" },
      { title: "Lewicki, Polin and Lount (2016), An Exploration of the Structure of Effective Apologies, Negotiation and Conflict Management Research", href: "https://doi.org/10.1111/ncmr.12073" },
      { title: "R is for Repair (The Gottman Institute)", href: "https://www.gottman.com/blog/r-is-for-repair/" },
      { title: "love is respect (US dating abuse helpline)", href: "https://www.loveisrespect.org/" },
    ],
  },
  "relationship-slump": {
    published: D,
    related: ["emotional-value", "should-you-get-back-together", "how-to-make-up-after-a-fight", "long-distance-relationship"],
    sources: [
      { title: "Aron et al. (2000), Couples' shared participation in novel and arousing activities and experienced relationship quality, Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.78.2.273" },
      { title: "An Introduction to Emotional Bids and Trust (The Gottman Institute)", href: "https://www.gottman.com/blog/an-introduction-to-emotional-bids-and-trust/" },
      { title: "Gable et al. (2004), What Do You Do When Things Go Right? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.87.2.228" },
    ],
  },
  "emotional-value": {
    published: D,
    related: ["relationship-slump", "how-to-make-up-after-a-fight", "attachment-styles", "red-flags-in-a-relationship"],
    sources: [
      { title: "An Introduction to Emotional Bids and Trust (The Gottman Institute)", href: "https://www.gottman.com/blog/an-introduction-to-emotional-bids-and-trust/" },
      { title: "Turn Towards Instead of Away (The Gottman Institute)", href: "https://www.gottman.com/blog/turn-toward-instead-of-away/" },
      { title: "Gable et al. (2004), What Do You Do When Things Go Right? Journal of Personality and Social Psychology", href: "https://doi.org/10.1037/0022-3514.87.2.228" },
    ],
  },
};

registerShelf("love", {
  meta: Object.fromEntries(LOVE_ARTICLES.map((id): [LoveId, KbMeta] => [id, { ...META[id], tools: [], tutorials: [], quizzes: [...(LOVE_ARTICLE_QUIZZES[id] ?? [])] }])) as Record<LoveId, KbMeta>,
  updated: LOVE_UPDATED,
  minutes: LOVE_MINUTES,
});
