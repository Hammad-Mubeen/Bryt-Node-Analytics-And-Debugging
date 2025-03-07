const whitelist = require("../../utils/whitelist");

module.exports = {
  table: "nodes",
  whitelist: (data) =>
    whitelist(data, [
      id,
      nodes
    ])
};
