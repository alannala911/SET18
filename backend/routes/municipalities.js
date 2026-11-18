// Eksponerer kommunedata gjennom offentlige leseruter
import { municipalities } from "../data/content.js";
import { contentRouter } from "../lib/contentRoutes.js";

export default contentRouter(municipalities, "Municipality not found");
