const whitelist = require("../../utils/whitelist");

module.exports = {
  table: "blocksQueue",
  whitelist: (data) =>
    whitelist(data, [
      id,
      rpcURL,
      hash,
      Status,
      timestamp,
      data
    ]),
};
