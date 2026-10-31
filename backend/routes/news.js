import { news } from "../data/content.js";
import { contentRouter } from "../lib/contentRoutes.js";

export default contentRouter(news, "News item not found");
