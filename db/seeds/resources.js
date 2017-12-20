exports.seed = function(knex, Promise) {
  return knex('resources').del()
    .then(function () {
      return Promise.all([
        knex('resources').insert({
          url: 'www.google.com',
          title: 'google',
          description: 'It is google'
        }),
        knex('resources').insert({
          url: 'www.lighthouselabs.ca',
          title: 'lighthouselabs',
          description: 'It is lighthouselabs'
        }),
        knex('resources').insert({
          url: 'www.example.com',
          title: 'example',
          description: 'It is example'
        })
      ]);
    });
};
