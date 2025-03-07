const {
    GraphQLObjectType,
    GraphQLString
} = require("graphql");

const ballotType = new GraphQLObjectType({
  
    name: "ballot",
    description: "ballot type",
    fields: () => ({
        rpcURL: {type : GraphQLString},
        hash: {type : GraphQLString},
        timestamp: {type : GraphQLString},
        data: {type : GraphQLString}
  })
});
  
module.exports = { ballotType };

