// Import required stuff from graphql
const { GraphQLSchema, GraphQLObjectType } = require("graphql");

// Import queries
const {
  allNodes,
  blocks,
  getBlocksBallotedAndTransactions
} = require("./queries");

// Define QueryType
const QueryType = new GraphQLObjectType({
  name: "QueryType",
  description: "Queries",
  fields: {
    allNodes,
    blocks,
    getBlocksBallotedAndTransactions
  },
});

module.exports = new GraphQLSchema({
  query: QueryType
});
