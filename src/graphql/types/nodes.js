const {
    GraphQLObjectType,
    GraphQLID,
    GraphQLString
} = require("graphql");

const nodesType = new GraphQLObjectType({
  
    name: "node",
    description: "node type",
    fields: () => ({
        id: {type : GraphQLID},
        portName: {type: GraphQLString},
        url: {type: GraphQLString}
  })
});
  
module.exports = { nodesType };

