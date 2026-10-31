import { courses } from "../data/content.js";
import { contentRouter } from "../lib/contentRoutes.js";

export default contentRouter(courses, "Course not found");
