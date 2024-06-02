import JSONBig from "json-bigint";
import axios from "axios";

axios.defaults.transformResponse = [
  (data) => {
    if (typeof data === "string") {
      try {
        data = JSONBig.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  }
];
