// Registers every locale up front. The Worker and tests use this; the client loads one pack at a time.
import en from "../locales/packs/en";
import es from "../locales/packs/es";
import id from "../locales/packs/id";
import ja from "../locales/packs/ja";
import ko from "../locales/packs/ko";
import vi from "../locales/packs/vi";
import zhCN from "../locales/packs/zh-CN";
import zhTW from "../locales/packs/zh-TW";
import { registerMessages } from "./messages";

registerMessages("en", en);
registerMessages("zh-CN", zhCN);
registerMessages("zh-TW", zhTW);
registerMessages("ja", ja);
registerMessages("ko", ko);
registerMessages("vi", vi);
registerMessages("id", id);
registerMessages("es", es);
