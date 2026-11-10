import { AI_ARTICLES, AI_ARTICLE_TOOLS, type AiId } from "./kb-ai";
import { registerShelf, type KbMeta } from "./kb";
import { AI_MINUTES, AI_UPDATED } from "../locales/kb/meta-ai";

/**
 * Sources, links and dates of the AI articles. Only kb pages need them, so this module rides in the kb packs
 * (src/locales/packs/kb-*.ts) and registers itself with kb.ts instead of sitting in the entry chunk.
 */
const D = "2026-11-02";
/** The AI short videos group. */
const D2 = "2026-11-10";

const META: Record<AiId, Omit<KbMeta, "tools">> = {
  "what-is-generative-ai": {
    published: D,
    tutorials: [],
    related: ["how-llms-work", "how-diffusion-models-work", "ai-hallucination", "ai-glossary"],
    sources: [
      { title: "Attention Is All You Need (Vaswani et al., 2017)", href: "https://arxiv.org/abs/1706.03762" },
      { title: "Denoising Diffusion Probabilistic Models (Ho et al., 2020)", href: "https://arxiv.org/abs/2006.11239" },
      { title: "Generative Adversarial Networks (Goodfellow et al., 2014)", href: "https://arxiv.org/abs/1406.2661" },
      { title: "NIST AI 600-1: Generative Artificial Intelligence Profile", href: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence" },
    ],
  },
  "how-llms-work": {
    published: D,
    tutorials: [],
    related: ["tokens-and-context-window", "ai-hallucination", "prompt-engineering-basics", "call-an-llm-api"],
    sources: [
      { title: "Attention Is All You Need (Vaswani et al., 2017)", href: "https://arxiv.org/abs/1706.03762" },
      { title: "Language Models are Few-Shot Learners (Brown et al., 2020)", href: "https://arxiv.org/abs/2005.14165" },
      { title: "Training language models to follow instructions with human feedback (Ouyang et al., 2022)", href: "https://arxiv.org/abs/2203.02155" },
      { title: "tiktoken: BPE tokenizer for OpenAI models (official repository)", href: "https://github.com/openai/tiktoken" },
    ],
  },
  "tokens-and-context-window": {
    published: D,
    tutorials: [],
    related: ["how-llms-work", "prompt-engineering-basics", "call-an-llm-api", "ai-glossary"],
    sources: [
      { title: "Neural Machine Translation of Rare Words with Subword Units (Sennrich et al., BPE)", href: "https://arxiv.org/abs/1508.07909" },
      { title: "tiktoken: BPE tokenizer for OpenAI models (official repository)", href: "https://github.com/openai/tiktoken" },
      { title: "Context windows (Claude API documentation)", href: "https://platform.claude.com/docs/en/build-with-claude/context-windows" },
      { title: "Lost in the Middle: How Language Models Use Long Contexts (Liu et al., 2023)", href: "https://arxiv.org/abs/2307.03172" },
    ],
  },
  "ai-hallucination": {
    published: D,
    tutorials: [],
    related: ["how-llms-work", "prompt-engineering-basics", "tokens-and-context-window", "what-are-ai-agents"],
    sources: [
      { title: "NIST AI 600-1: Generative Artificial Intelligence Profile (section 2.2, Confabulation)", href: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence" },
      { title: "Why Language Models Hallucinate (Kalai et al., 2025)", href: "https://arxiv.org/abs/2509.04664" },
      { title: "TruthfulQA: Measuring How Models Mimic Human Falsehoods (Lin et al.)", href: "https://arxiv.org/abs/2109.07958" },
      { title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al., 2020)", href: "https://arxiv.org/abs/2005.11401" },
      { title: "Survey of Hallucination in Natural Language Generation (Ji et al.)", href: "https://arxiv.org/abs/2202.03629" },
    ],
  },
  "how-diffusion-models-work": {
    published: D,
    tutorials: [],
    related: ["what-is-generative-ai", "text-to-image", "image-prompts", "image-to-image"],
    sources: [
      { title: "Denoising Diffusion Probabilistic Models (Ho, Jain, Abbeel, 2020)", href: "https://arxiv.org/abs/2006.11239" },
      { title: "Denoising Diffusion Implicit Models (Song, Meng, Ermon, 2020)", href: "https://arxiv.org/abs/2010.02502" },
      { title: "High-Resolution Image Synthesis with Latent Diffusion Models (Rombach et al., 2021)", href: "https://arxiv.org/abs/2112.10752" },
      { title: "Classifier-Free Diffusion Guidance (Ho, Salimans, 2022)", href: "https://arxiv.org/abs/2207.12598" },
      { title: "Extracting Training Data from Diffusion Models (Carlini et al., 2023)", href: "https://arxiv.org/abs/2301.13188" },
    ],
  },
  "what-are-ai-agents": {
    published: D,
    tutorials: [],
    related: ["how-llms-work", "call-an-llm-api", "prompt-engineering-basics", "ai-hallucination"],
    sources: [
      { title: "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022)", href: "https://arxiv.org/abs/2210.03629" },
      { title: "Anthropic: Building effective agents", href: "https://www.anthropic.com/research/building-effective-agents" },
      { title: "OpenAI API docs: Function calling", href: "https://developers.openai.com/api/docs/guides/function-calling" },
      { title: "Model Context Protocol specification", href: "https://modelcontextprotocol.io/specification" },
    ],
  },
  "ai-glossary": {
    published: D,
    tutorials: [],
    related: ["what-is-generative-ai", "how-llms-work", "how-diffusion-models-work", "labeling-ai-content"],
    sources: [
      { title: "NIST AI 600-1: Generative Artificial Intelligence Profile", href: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence" },
      { title: "Attention Is All You Need (Vaswani et al., 2017)", href: "https://arxiv.org/abs/1706.03762" },
      { title: "C2PA Technical Specification (Content Credentials)", href: "https://spec.c2pa.org/specifications/specifications/2.1/specs/C2PA_Specification.html" },
      { title: "Measures for Labeling AI-Generated Synthetic Content (Cyberspace Administration of China, 2025)", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
      { title: "AI Act: regulatory framework for AI (European Commission)", href: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai" },
    ],
  },
  "prompt-engineering-basics": {
    published: D,
    tutorials: [],
    related: ["image-prompts", "ai-hallucination", "how-llms-work", "call-an-llm-api"],
    sources: [
      { title: "OpenAI API docs: Prompt engineering", href: "https://developers.openai.com/api/docs/guides/prompt-engineering" },
      { title: "Claude docs: Prompt engineering overview", href: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview" },
      { title: "Gemini API docs: Prompt design strategies", href: "https://ai.google.dev/gemini-api/docs/prompting-strategies" },
      { title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models (Wei et al., 2022)", href: "https://arxiv.org/abs/2201.11903" },
    ],
  },
  "image-prompts": {
    published: D,
    tutorials: [],
    related: ["prompt-engineering-basics", "text-to-image", "consistent-ai-characters", "video-prompts"],
    sources: [
      { title: "High-Resolution Image Synthesis with Latent Diffusion Models (Rombach et al.)", href: "https://arxiv.org/abs/2112.10752" },
      { title: "Classifier-Free Diffusion Guidance (Ho and Salimans)", href: "https://arxiv.org/abs/2207.12598" },
      { title: "Hugging Face Diffusers: Text-to-image (guidance scale, negative prompt)", href: "https://huggingface.co/docs/diffusers/using-diffusers/conditional_image_generation" },
    ],
  },
  "video-prompts": {
    published: D,
    tutorials: [],
    related: ["camera-movement-terms", "storyboard-prompts", "text-to-video", "short-video-script", "image-prompts"],
    sources: [
      { title: "Sora 2 Prompting Guide (OpenAI Cookbook)", href: "https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide" },
      { title: "Veo on Vertex AI video generation prompt guide (Google Cloud)", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide" },
      { title: "Video Diffusion Models (Ho et al., 2022)", href: "https://arxiv.org/abs/2204.03458" },
    ],
  },
  "camera-movement-terms": {
    published: D,
    tutorials: [],
    related: ["video-prompts", "storyboard-prompts", "image-to-video", "multi-shot-ai-video"],
    sources: [
      { title: "Veo on Vertex AI video generation prompt guide (Google Cloud)", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide" },
      { title: "CameraCtrl: Enabling Camera Control for Text-to-Video Generation (He et al., 2024)", href: "https://arxiv.org/abs/2404.02101" },
      { title: "Stable Video Diffusion: Scaling Latent Video Diffusion Models to Large Datasets (Blattmann et al., 2023)", href: "https://arxiv.org/abs/2311.15127" },
      { title: "Sora 2 Prompting Guide (OpenAI Cookbook)", href: "https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide" },
    ],
  },
  "storyboard-prompts": {
    published: D,
    tutorials: [],
    related: ["video-prompts", "camera-movement-terms", "multi-shot-ai-video", "ai-short-drama-workflow"],
    sources: [
      { title: "Google Cloud: Veo video generation prompt guide", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide" },
      { title: "Google Cloud: Generate videos from first and last frames", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames" },
      { title: "Google Cloud: Use reference images to guide video generation", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/use-reference-images-to-guide-video-generation" },
    ],
  },
  "text-to-image": {
    published: D,
    tutorials: [],
    related: ["image-prompts", "how-diffusion-models-work", "image-to-image", "how-ai-upscaling-works"],
    sources: [
      { title: "High-Resolution Image Synthesis with Latent Diffusion Models (Rombach et al.)", href: "https://arxiv.org/abs/2112.10752" },
      { title: "Classifier-Free Diffusion Guidance (Ho and Salimans)", href: "https://arxiv.org/abs/2207.12598" },
      { title: "SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis", href: "https://arxiv.org/abs/2307.01952" },
      { title: "Janus-Pro: Unified Multimodal Understanding and Generation with Data and Model Scaling", href: "https://arxiv.org/abs/2501.17811" },
      { title: "Hugging Face Diffusers: Reproducibility (seeds and generators)", href: "https://huggingface.co/docs/diffusers/using-diffusers/reusing_seeds" },
    ],
  },
  "image-to-image": {
    published: D,
    tutorials: [],
    related: ["text-to-image", "what-is-a-depth-map", "consistent-ai-characters", "how-ai-background-removal-works"],
    sources: [
      { title: "SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations", href: "https://arxiv.org/abs/2108.01073" },
      { title: "Adding Conditional Control to Text-to-Image Diffusion Models (ControlNet)", href: "https://arxiv.org/abs/2302.05543" },
      { title: "RePaint: Inpainting using Denoising Diffusion Probabilistic Models", href: "https://arxiv.org/abs/2201.09865" },
      { title: "IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models", href: "https://arxiv.org/abs/2308.06721" },
      { title: "Hugging Face Diffusers: Image-to-image (strength, guidance, negative prompt)", href: "https://huggingface.co/docs/diffusers/using-diffusers/img2img" },
    ],
  },
  "consistent-ai-characters": {
    published: D,
    tutorials: [],
    related: ["image-prompts", "image-to-image", "multi-shot-ai-video", "ai-short-drama-workflow"],
    sources: [
      { title: "DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation", href: "https://arxiv.org/abs/2208.12242" },
      { title: "An Image is Worth One Word: Personalizing Text-to-Image Generation using Textual Inversion", href: "https://arxiv.org/abs/2208.01618" },
      { title: "LoRA: Low-Rank Adaptation of Large Language Models", href: "https://arxiv.org/abs/2106.09685" },
      { title: "IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models", href: "https://arxiv.org/abs/2308.06721" },
      { title: "Hugging Face Diffusers: Reproducibility (seeds and generators)", href: "https://huggingface.co/docs/diffusers/using-diffusers/reusing_seeds" },
    ],
  },
  "how-ai-upscaling-works": {
    published: D,
    tutorials: [],
    related: ["text-to-image", "image-to-image", "how-diffusion-models-work", "run-ai-in-the-browser"],
    sources: [
      { title: "Image Super-Resolution Using Deep Convolutional Networks (SRCNN)", href: "https://arxiv.org/abs/1501.00092" },
      { title: "Photo-Realistic Single Image Super-Resolution Using a Generative Adversarial Network (SRGAN)", href: "https://arxiv.org/abs/1609.04802" },
      { title: "ESRGAN: Enhanced Super-Resolution Generative Adversarial Networks", href: "https://arxiv.org/abs/1809.00219" },
      { title: "Real-ESRGAN: Training Real-World Blind Super-Resolution with Pure Synthetic Data", href: "https://arxiv.org/abs/2107.10833" },
      { title: "Image Super-Resolution via Iterative Refinement (SR3)", href: "https://arxiv.org/abs/2104.07636" },
    ],
  },
  "how-ai-background-removal-works": {
    published: D,
    tutorials: ["remove-photo-background"],
    related: ["what-is-a-depth-map", "how-ai-upscaling-works", "image-to-image", "run-ai-in-the-browser"],
    sources: [
      { title: "Bilateral Reference for High-Resolution Dichotomous Image Segmentation (BiRefNet), arXiv:2401.03407", href: "https://arxiv.org/abs/2401.03407" },
      { title: "Highly Accurate Dichotomous Image Segmentation (DIS5K, IS-Net), arXiv:2203.03041", href: "https://arxiv.org/abs/2203.03041" },
      { title: "Deep Image Matting, arXiv:1703.03872", href: "https://arxiv.org/abs/1703.03872" },
      { title: "Portable Network Graphics (PNG) Specification (Third Edition), W3C", href: "https://www.w3.org/TR/png-3/" },
    ],
  },
  "what-is-a-depth-map": {
    published: D,
    tutorials: [],
    related: ["image-to-video", "how-ai-background-removal-works", "camera-movement-terms", "image-to-image"],
    sources: [
      { title: "Depth Anything V2, arXiv:2406.09414", href: "https://arxiv.org/abs/2406.09414" },
      { title: "Towards Robust Monocular Depth Estimation: Mixing Datasets for Zero-shot Cross-dataset Transfer (MiDaS), arXiv:1907.01341", href: "https://arxiv.org/abs/1907.01341" },
      { title: "Adding Conditional Control to Text-to-Image Diffusion Models (ControlNet), arXiv:2302.05543", href: "https://arxiv.org/abs/2302.05543" },
    ],
  },
  "text-to-video": {
    published: D,
    tutorials: [],
    related: ["how-to-make-ai-videos", "video-prompts", "image-to-video", "how-diffusion-models-work", "multi-shot-ai-video"],
    sources: [
      { title: "Video Diffusion Models (Ho et al., 2022)", href: "https://arxiv.org/abs/2204.03458" },
      { title: "Imagen Video: High Definition Video Generation with Diffusion Models (Ho et al., 2022)", href: "https://arxiv.org/abs/2210.02303" },
      { title: "Stable Video Diffusion: Scaling Latent Video Diffusion Models to Large Datasets (Blattmann et al., 2023)", href: "https://arxiv.org/abs/2311.15127" },
      { title: "Video generation models as world simulators (OpenAI Sora technical report)", href: "https://openai.com/index/video-generation-models-as-world-simulators/" },
      { title: "Sora 2 Prompting Guide (OpenAI Cookbook)", href: "https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide" },
    ],
  },
  "image-to-video": {
    published: D,
    tutorials: [],
    related: ["how-to-make-ai-videos", "text-to-video", "first-last-frame-video", "what-is-a-depth-map", "camera-movement-terms"],
    sources: [
      { title: "Generate videos from an image with Veo on Vertex AI (Google Cloud)", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-an-image" },
      { title: "Stable Video Diffusion: Scaling Latent Video Diffusion Models to Large Datasets (Blattmann et al., 2023)", href: "https://arxiv.org/abs/2311.15127" },
      { title: "3D Ken Burns Effect from a Single Image (Niklaus et al., 2019)", href: "https://arxiv.org/abs/1909.05483" },
      { title: "Depth Anything V2 (Yang et al., 2024)", href: "https://arxiv.org/abs/2406.09414" },
      { title: "Sora 2 Prompting Guide (OpenAI Cookbook)", href: "https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide" },
    ],
  },
  "first-last-frame-video": {
    published: D,
    tutorials: [],
    related: ["image-to-video", "multi-shot-ai-video", "storyboard-prompts", "video-prompts"],
    sources: [
      { title: "Generate videos with Veo on Vertex AI using first and last video frames (Google Cloud)", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames" },
      { title: "Generative Inbetweening: Adapting Image-to-Video Models for Keyframe Interpolation (Wang et al., 2024)", href: "https://arxiv.org/abs/2408.15239" },
      { title: "FILM: Frame Interpolation for Large Motion (Reda et al., 2022)", href: "https://arxiv.org/abs/2202.04901" },
    ],
  },
  "multi-shot-ai-video": {
    published: D,
    tutorials: [],
    related: ["storyboard-prompts", "consistent-ai-characters", "first-last-frame-video", "ai-short-drama-workflow"],
    sources: [
      { title: "Long Context Tuning for Video Generation (arXiv:2503.10589)", href: "https://arxiv.org/abs/2503.10589" },
      { title: "Seedance 1.0: Exploring the Boundaries of Video Generation Models (arXiv:2506.09113)", href: "https://arxiv.org/abs/2506.09113" },
      { title: "Google Cloud: Use reference images to guide video generation", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/use-reference-images-to-guide-video-generation" },
      { title: "Google Cloud: Generate videos from first and last frames", href: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames" },
    ],
  },
  "ai-short-drama-workflow": {
    published: D,
    tutorials: [],
    related: ["storyboard-prompts", "multi-shot-ai-video", "consistent-ai-characters", "ai-short-video-workflow", "labeling-ai-content"],
    sources: [
      { title: "YouTube Help: Understand three-minute YouTube Shorts", href: "https://support.google.com/youtube/answer/15424877" },
      { title: "YouTube Help: Disclosing use of altered or synthetic content", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "YouTube Help: Supported subtitle and closed caption files", href: "https://support.google.com/youtube/answer/2734698" },
      { title: "TikTok Community Guidelines: Integrity and Authenticity", href: "https://www.tiktok.com/community-guidelines/en/integrity-authenticity" },
      { title: "CAC: Measures for Labeling AI-Generated Synthetic Content (人工智能生成合成内容标识办法)", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
    ],
  },
  "how-speech-to-text-works": {
    published: D,
    tutorials: [],
    related: ["auto-captions", "text-to-speech", "ai-hallucination", "run-ai-in-the-browser", "ai-short-drama-workflow"],
    sources: [
      { title: "Robust Speech Recognition via Large-Scale Weak Supervision (Whisper), arXiv:2212.04356", href: "https://arxiv.org/abs/2212.04356" },
      { title: "openai/whisper repository (model card, approach, license)", href: "https://github.com/openai/whisper" },
      { title: "Web Speech API, MDN Web Docs", href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API" },
      { title: "WebVTT: The Web Video Text Tracks Format, W3C", href: "https://www.w3.org/TR/webvtt1/" },
    ],
  },
  "text-to-speech": {
    published: D,
    tutorials: [],
    related: ["ai-voiceover", "how-speech-to-text-works", "labeling-ai-content", "ai-copyright-and-commercial-use", "ai-short-drama-workflow"],
    sources: [
      { title: "Web Speech API specification (W3C Community Group)", href: "https://webaudio.github.io/web-speech-api/" },
      { title: "Speech Synthesis Markup Language (SSML) Version 1.1, W3C Recommendation", href: "https://www.w3.org/TR/speech-synthesis11/" },
      { title: "Natural TTS Synthesis by Conditioning WaveNet on Mel Spectrogram Predictions (Tacotron 2), arXiv:1712.05884", href: "https://arxiv.org/abs/1712.05884" },
      { title: "Provisions on the Administration of Deep Synthesis of Internet-based Information Services (CAC)", href: "https://www.cac.gov.cn/2022-12/11/c_1672221949354811.htm" },
      { title: "Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 50", href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
    ],
  },
  "run-ai-in-the-browser": {
    published: D,
    tutorials: [],
    related: ["how-ai-background-removal-works", "how-speech-to-text-works", "call-an-llm-api", "how-ai-upscaling-works"],
    sources: [
      { title: "W3C: WebGPU (Candidate Recommendation Draft)", href: "https://www.w3.org/TR/webgpu/" },
      { title: "MDN Web Docs: WebGPU API", href: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" },
      { title: "ONNX Runtime docs: ONNX Runtime Web", href: "https://onnxruntime.ai/docs/tutorials/web/" },
      { title: "Hugging Face: Transformers.js documentation", href: "https://huggingface.co/docs/transformers.js/index" },
      { title: "MDN Web Docs: Storage quotas and eviction criteria", href: "https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria" },
    ],
  },
  "call-an-llm-api": {
    published: D,
    tutorials: [],
    related: ["how-llms-work", "tokens-and-context-window", "what-are-ai-agents", "prompt-engineering-basics"],
    sources: [
      { title: "OpenAI API reference: Create chat completion", href: "https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create" },
      { title: "Claude API reference: Messages", href: "https://platform.claude.com/docs/en/api/messages" },
      { title: "Gemini API reference: Generating content", href: "https://ai.google.dev/api/generate-content" },
      { title: "OpenAI API docs: Rate limits", href: "https://developers.openai.com/api/docs/guides/rate-limits" },
      { title: "OpenAI API docs: Structured outputs", href: "https://developers.openai.com/api/docs/guides/structured-outputs" },
    ],
  },
  "ai-copyright-and-commercial-use": {
    published: D,
    tutorials: [],
    related: ["labeling-ai-content", "c2pa-and-ai-watermarks", "what-is-generative-ai", "consistent-ai-characters"],
    sources: [
      { title: "U.S. Copyright Office: Copyright and Artificial Intelligence, Part 2: Copyrightability (2025)", href: "https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf" },
      { title: "U.S. Copyright Office: Registration Guidance for Works Containing AI-Generated Material (2023)", href: "https://www.copyright.gov/ai/ai_policy_guidance.pdf" },
      { title: "U.S. Copyright Office: Copyright and Artificial Intelligence (reports index)", href: "https://www.copyright.gov/ai/" },
      { title: "Beijing Internet Court: Civil Judgment (2023) Jing 0491 Min Chu No. 11279 (English)", href: "https://english.bjinternetcourt.gov.cn/pdf/BeijingInternetCourtCivilJudgment112792023.pdf" },
      { title: "European Commission AI Act Service Desk: Article 53, obligations for providers of general-purpose AI models", href: "https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-53" },
    ],
  },
  "labeling-ai-content": {
    published: D,
    tutorials: [],
    related: ["c2pa-and-ai-watermarks", "ai-copyright-and-commercial-use", "ai-short-drama-workflow"],
    sources: [
      { title: "CAC: Measures for Labeling AI-Generated Synthetic Content (人工智能生成合成内容标识办法)", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
      { title: "European Commission AI Act Service Desk: Article 50, transparency obligations", href: "https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50" },
      { title: "YouTube Help: Disclosing use of altered or synthetic content", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "TikTok Community Guidelines: Integrity and Authenticity", href: "https://www.tiktok.com/community-guidelines/en/integrity-authenticity" },
      { title: "Meta Help: How to identify AI content on Meta products", href: "https://www.meta.com/help/artificial-intelligence/1783222608822690/" },
    ],
  },
  "c2pa-and-ai-watermarks": {
    published: D,
    tutorials: [],
    related: ["labeling-ai-content", "ai-copyright-and-commercial-use", "what-is-generative-ai"],
    sources: [
      { title: "Content Credentials: C2PA Technical Specification 2.5", href: "https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html" },
      { title: "C2PA Explainer 2.2", href: "https://spec.c2pa.org/specifications/specifications/2.2/explainer/Explainer.html" },
      { title: "IPTC NewsCodes: Digital Source Type", href: "https://cv.iptc.org/newscodes/digitalsourcetype/" },
      { title: "SynthID, Google DeepMind", href: "https://deepmind.google/models/synthid/" },
      { title: "Measures for Labeling AI-Generated Synthetic Content (CAC)", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
    ],
  },
  "how-to-make-ai-videos": {
    published: D2,
    tutorials: [],
    related: ["ai-short-video-workflow", "image-to-video", "video-prompts", "labeling-ai-content"],
    sources: [
      { title: "YouTube Help: Disclosing use of GenAI content", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "TikTok Newsroom: New labels for disclosing AI-generated content", href: "https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content" },
      { title: "Cyberspace Administration of China: Measures for Labeling AI-Generated Synthetic Content", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
    ],
  },
  "ai-short-video-workflow": {
    published: D2,
    tutorials: [],
    related: ["short-video-script", "vertical-video-sizes", "multi-shot-ai-video", "ai-short-drama-workflow"],
    sources: [
      { title: "YouTube Help: Understand three-minute YouTube Shorts", href: "https://support.google.com/youtube/answer/15424877" },
      { title: "YouTube Help: How engagement metrics are counted", href: "https://support.google.com/youtube/answer/2991785" },
      { title: "YouTube Help: Disclosing use of GenAI content", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "TikTok Newsroom: Partnering with our industry to advance AI transparency and literacy", href: "https://newsroom.tiktok.com/en-us/partnering-with-our-industry-to-advance-ai-transparency-and-literacy" },
      { title: "Cyberspace Administration of China: Measures for Labeling AI-Generated Synthetic Content", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
    ],
  },
  "vertical-video-sizes": {
    published: D2,
    tutorials: [],
    related: ["ai-short-video-workflow", "ai-video-editing", "auto-captions", "how-ai-upscaling-works"],
    sources: [
      { title: "Understand three-minute YouTube Shorts — YouTube Help", href: "https://support.google.com/youtube/answer/15424877" },
      { title: "Get started creating YouTube Shorts — YouTube Help", href: "https://support.google.com/youtube/answer/10059070" },
      { title: "Creator tools on TikTok (TikTok Studio upload requirements) — TikTok Support", href: "https://support.tiktok.com/en/using-tiktok/creating-videos/creator-tools-on-tiktok" },
      { title: "Reel size and aspect ratios on Instagram — Instagram Help Center", href: "https://help.instagram.com/1038071743007909" },
      { title: "Video ad specs for Instagram Reels (safe zone) — Meta Ads Guide", href: "https://www.facebook.com/business/ads-guide/update/video/instagram-reels" },
      { title: "Instagram Help: How long can reels be", href: "https://help.instagram.com/225190788256708" },
    ],
  },
  "short-video-script": {
    published: D2,
    tutorials: [],
    related: ["ai-short-video-workflow", "ai-voiceover", "storyboard-prompts", "video-prompts"],
    sources: [
      { title: "Get started creating YouTube Shorts — YouTube Help", href: "https://support.google.com/youtube/answer/10059070" },
      { title: "Understand your content reach and engagement (Shorts: stayed to watch) — YouTube Help", href: "https://support.google.com/youtube/answer/12220281" },
      { title: "Disclosing use of GenAI content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
    ],
  },
  "ai-voiceover": {
    published: D2,
    tutorials: [],
    related: ["text-to-speech", "ai-lip-sync", "auto-captions", "labeling-ai-content"],
    sources: [
      { title: "ITU-R BS.1770: Algorithms to measure audio programme loudness and true-peak audio level", href: "https://www.itu.int/rec/R-REC-BS.1770" },
      { title: "EBU R 128: Loudness normalisation and permitted maximum level of audio signals", href: "https://tech.ebu.ch/publications/r128" },
      { title: "Speech Synthesis Markup Language (SSML) Version 1.1 — W3C", href: "https://www.w3.org/TR/speech-synthesis11/" },
      { title: "Use automatic dubbing — YouTube Help", href: "https://support.google.com/youtube/answer/15569972" },
      { title: "Disclosing use of GenAI content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
    ],
  },
  "auto-captions": {
    published: D2,
    tutorials: [],
    related: ["how-speech-to-text-works", "vertical-video-sizes", "ai-voiceover", "ai-video-editing"],
    sources: [
      { title: "Robust Speech Recognition via Large-Scale Weak Supervision (Whisper), arXiv:2212.04356", href: "https://arxiv.org/abs/2212.04356" },
      { title: "Use automatic captioning — YouTube Help", href: "https://support.google.com/youtube/answer/6373554" },
      { title: "English (USA) Timed Text Style Guide — Netflix Partner Help Center", href: "https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide" },
      { title: "Chinese (Simplified) Timed Text Style Guide — Netflix Partner Help Center", href: "https://partnerhelp.netflixstudios.com/hc/en-us/articles/215986007-Chinese-Simplified-Timed-Text-Style-Guide" },
      { title: "WebVTT: The Web Video Text Tracks Format — W3C", href: "https://www.w3.org/TR/webvtt1/" },
    ],
  },
  "ai-video-editing": {
    published: D2,
    tutorials: [],
    related: ["auto-captions", "vertical-video-sizes", "how-ai-upscaling-works", "labeling-ai-content"],
    sources: [
      { title: "Real-Time Intermediate Flow Estimation for Video Frame Interpolation (RIFE), arXiv:2011.06294", href: "https://arxiv.org/abs/2011.06294" },
      { title: "Real-ESRGAN: Training Real-World Blind Super-Resolution with Pure Synthetic Data, arXiv:2107.10833", href: "https://arxiv.org/abs/2107.10833" },
      { title: "Hybrid Spectrogram and Waveform Source Separation (Hybrid Demucs), arXiv:2111.03600", href: "https://arxiv.org/abs/2111.03600" },
      { title: "Robust Speech Recognition via Large-Scale Weak Supervision (Whisper), arXiv:2212.04356", href: "https://arxiv.org/abs/2212.04356" },
      { title: "Disclosing use of altered or synthetic content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
    ],
  },
  "ai-lip-sync": {
    published: D2,
    tutorials: [],
    related: ["ai-voiceover", "ai-music-video", "image-to-video", "labeling-ai-content"],
    sources: [
      { title: "A Lip Sync Expert Is All You Need for Speech to Lip Generation In The Wild (Wav2Lip), arXiv:2008.10010", href: "https://arxiv.org/abs/2008.10010" },
      { title: "Disclosing use of GenAI content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "Regulation (EU) 2024/1689 (AI Act), Article 50 — EUR-Lex", href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
      { title: "人工智能生成合成内容标识办法 (Measures for Labeling AI-Generated Synthetic Content) — CAC", href: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm" },
      { title: "Use automatic dubbing (experimental lip sync) — YouTube Help", href: "https://support.google.com/youtube/answer/15569972" },
    ],
  },
  "ai-music-video": {
    published: D2,
    tutorials: [],
    related: ["ai-dance-video", "ai-lip-sync", "multi-shot-ai-video", "consistent-ai-characters"],
    sources: [
      { title: "How Content ID works — YouTube Help", href: "https://support.google.com/youtube/answer/2797370" },
      { title: "Disclosing use of altered or synthetic content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "A Lip Sync Expert Is All You Need for Speech to Lip Generation In The Wild (Wav2Lip)", href: "https://arxiv.org/abs/2008.10010" },
      { title: "Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 50", href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
    ],
  },
  "ai-dance-video": {
    published: D2,
    tutorials: [],
    related: ["ai-music-video", "image-to-video", "storyboard-prompts", "consistent-ai-characters"],
    sources: [
      { title: "Everybody Dance Now (Chan et al.)", href: "https://arxiv.org/abs/1808.07371" },
      { title: "Animate Anyone: Consistent and Controllable Image-to-Video Synthesis for Character Animation", href: "https://arxiv.org/abs/2311.17117" },
      { title: "Disclosing use of altered or synthetic content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "Copyright and Artificial Intelligence (incl. Part 1: Digital Replicas) — U.S. Copyright Office", href: "https://www.copyright.gov/ai/" },
    ],
  },
  "ai-animated-video": {
    published: D2,
    tutorials: [],
    related: ["consistent-ai-characters", "image-to-video", "ai-lip-sync", "ai-copyright-and-commercial-use"],
    sources: [
      { title: "AnimateDiff: Animate Your Personalized Text-to-Image Diffusion Models without Specific Tuning", href: "https://arxiv.org/abs/2307.04725" },
      { title: "Copyright and Artificial Intelligence, Part 2: Copyrightability — U.S. Copyright Office", href: "https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf" },
      { title: "Disclosing use of altered or synthetic content — YouTube Help", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 50", href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
    ],
  },
  "faceless-channel-with-ai": {
    published: D2,
    tutorials: [],
    related: ["ai-short-video-workflow", "ai-voiceover", "ai-copyright-and-commercial-use", "labeling-ai-content"],
    sources: [
      { title: "YouTube Help: YouTube channel monetization policies", href: "https://support.google.com/youtube/answer/1311392" },
      { title: "YouTube Help: How to earn money on YouTube", href: "https://support.google.com/youtube/answer/72857" },
      { title: "YouTube Help: Disclosing use of GenAI content", href: "https://support.google.com/youtube/answer/14328491" },
      { title: "TikTok Newsroom: Introducing the New Creator Rewards Program", href: "https://newsroom.tiktok.com/en-us/introducing-the-new-creator-rewards-program" },
      { title: "TikTok Newsroom: New labels for disclosing AI-generated content", href: "https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content" },
    ],
  },
};

registerShelf("ai", {
  meta: Object.fromEntries(AI_ARTICLES.map((id) => [id, { ...META[id], tools: [...(AI_ARTICLE_TOOLS[id] ?? [])] }])) as Record<AiId, KbMeta>,
  updated: AI_UPDATED,
  minutes: AI_MINUTES,
});
