// Test UI strings and hub copy, loaded only on /tests/ pages; each test's own copy is a separate chunk (src/locales/quiz/loaders).
import quiz from "../quiz/zh-CN.json";
import type { QuizMessages } from "../../shared/messages";

export default quiz satisfies QuizMessages;
