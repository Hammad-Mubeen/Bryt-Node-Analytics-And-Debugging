const whitelist = require("../../utils/whitelist");

module.exports = {
  table: "ballotedTransactionsQueue",
  whitelist: (data) =>
    whitelist(data, [
      id,
      rpcURL,
      hash,
      block_number,
      Status,
      timestamp,
      data
    ])
};
