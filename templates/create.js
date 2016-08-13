var TABLE_NAME = '<%= tableName %>';

TABLE_NAME = `${process.env.NODE_ENV === 'test' ? '_test_' : ''}${TABLE_NAME}`;

module.exports.default = {
  up: {
    method: 'createTable',
    params: {
      AttributeDefinitions: [ /* required */
        {
          AttributeName: 'STRING_VALUE', /* required */
          AttributeType: 'S | N | B' /* required */
        },
        /* more items */
      ],
      KeySchema: [ /* required */
        {
          AttributeName: 'STRING_VALUE', /* required */
          KeyType: 'HASH | RANGE' /* required */
        },
        /* more items */
      ],
      ProvisionedThroughput: { /* required */
        ReadCapacityUnits: 0, /* required */
        WriteCapacityUnits: 0 /* required */
      },
      TableName: TABLE_NAME, /* required */
      GlobalSecondaryIndexes: [
        {
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
        /* more items */
      ],
      LocalSecondaryIndexes: [
        {
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
          }
        },
        /* more items */
      ],
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