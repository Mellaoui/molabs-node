# Authentication Service

## Stack
- Typescript (language)
- OpenAPI (for documentation & design)
- TypeORM (have to configure the DB on your own)
- Serverless (so all functions in `src/functions` folder)

## Steps for setup

- Setup your postgres DB (just use docker, it's the easiest)
- `yarn migrate`
- `yarn keys:gen` (for generating the ECDSA keys used to generate JWT tokens)
- `yarn admin:gen` (if you want a local admin user)

## Testing

- We're using jest for running tests, so run `yarn test` to run the full suite

## Updating routes & models

- First, update the openAPI doc and update the routes/models you need
- Then run `yarn generate:types`
- This keeps the OpenAPI doc & our API in sync and removes the need for writing a lot of boilerplate
- All routes are to be kept `src/routes`, so add/update/remove in the folder itself
