const whitelist = require("../../utils/whitelist");

module.exports = {
  table: "ballotedData",
  whitelist: (data) =>
    whitelist(data, [
      id,
      rpcURL,
      hash,
      timestamp,
      data
    ])
};
