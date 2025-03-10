const whitelist = require("../../utils/whitelist");

module.exports = {
  table: "ballotedData",
  whitelist: (data) =>
    whitelist(data, [
      id,
      rpcURL,
      hash,
      block_number,
      timestamp,
      data
    ])
};
