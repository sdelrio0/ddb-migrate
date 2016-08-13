var TABLE_NAME = '<%= tableName %>';

TABLE_NAME = `${process.env.NODE_ENV === 'test' ? '_test_' : ''}${TABLE_NAME}`;

module.exports.default = {
  up: {
    method: 'updateTable',
    params: {
      TableName: TABLE_NAME, /* required */
      AttributeDefinitions: [
        {
          AttributeName: 'STRING_VALUE', /* required */
          AttributeType: 'S | N | B' /* required */
        },
        /* more items */
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'STRING_VALUE', /* required */
            KeySchema: [ /* required */
              {
                AttributeName: 'STRING_VALUE', /* required */
                KeyType: 'HASH | RANGE' /* required */
              },
              /* more items */
            ],
            Projection: { /* required */
              NonKeyAttributes: [
                'STRING_VALUE',
                /* more items */
              ],
              ProjectionType: 'ALL | KEYS_ONLY | INCLUDE'
            },
            ProvisionedThroughput: { /* required */
              ReadCapacityUnits: 0, /* required */
              WriteCapacityUnits: 0 /* required */
            }
          },
          Delete: {
            IndexName: 'STRING_VALUE' /* required */
          },
          Update: {
            IndexName: 'STRING_VALUE', /* required */
            ProvisionedThroughput: { /* required */
              ReadCapacityUnits: 0, /* required */
              WriteCapacityUnits: 0 /* required */
            }
          }
        },
        /* more items */
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 0, /* required */
        WriteCapacityUnits: 0 /* required */
      },
      StreamSpecification: {
        StreamEnabled: true || false,
        StreamViewType: 'NEW_IMAGE | OLD_IMAGE | NEW_AND_OLD_IMAGES | KEYS_ONLY'
      }
    }
  },
  
  down: {
    method: 'deleteTable',
    params: {
      TableName: TABLE_NAME
    }
  }
};