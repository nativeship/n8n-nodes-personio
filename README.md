# Personio n8n community node

Personio helps HR teams manage people data, time, talent, and everyday HR workflows.

Generated from OpenAPI 2.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated bearer token credential in n8n before using the node.

## Supported operations

- `POST /absence-periods` - Create Absence Period
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /absence-periods/{id}` - Delete Absence Period
  - Retry Contract: none
  - Pagination Contract: none
- `GET /absence-periods/{id}/breakdowns` - Get Daily Absence Breakdowns
  - Retry Contract: none
  - Pagination Contract: none
- `GET /absence-periods/{id}` - Get Absence Period
  - Retry Contract: none
  - Pagination Contract: none
- `GET /absence-periods` - List Absence Periods
  - Retry Contract: none
  - Pagination Contract: none
- `GET /absence-types` - List Absence Types
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /absence-periods/{id}` - Update Absence Period
  - Retry Contract: none
  - Pagination Contract: none
- `POST /attendance-periods` - Create Attendance Period
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /attendance-periods/{id}` - Delete Attendance Period
  - Retry Contract: none
  - Pagination Contract: none
- `GET /attendance-periods/{id}` - Get Attendance Period
  - Retry Contract: none
  - Pagination Contract: none
- `GET /attendance-periods` - List Attendance Periods
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /attendance-periods/{id}` - Update Attendance Period
  - Retry Contract: none
  - Pagination Contract: none
- `POST /auth/token` - Obtain Access Token
  - Retry Contract: none
  - Pagination Contract: none
- `POST /auth/revoke` - Revoke Access Token
  - Retry Contract: none
  - Pagination Contract: none
- `POST /compensations` - Create Compensation Record
  - Retry Contract: none
  - Pagination Contract: none
- `POST /compensations/types` - Create Compensation Type
  - Retry Contract: none
  - Pagination Contract: none
- `GET /compensations/types` - List Compensation Types
  - Retry Contract: none
  - Pagination Contract: none
- `GET /compensations` - List Compensation Records
  - Retry Contract: none
  - Pagination Contract: none
- `GET /document-management/documents/{id}/download` - Download document
  - Retry Contract: none
  - Pagination Contract: none
- `GET /document-management/documents` - List Documents
  - Retry Contract: none
  - Pagination Contract: none
- `GET /persons/{person-id}/employments/{id}` - Get employment
  - Retry Contract: none
  - Pagination Contract: none
- `GET /persons/{person-id}/employments` - List a Person's Employments
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /persons/{person-id}/employments/{employment-id}` - Update employment
  - Retry Contract: none
  - Pagination Contract: none
- `GET /legal-entities` - List Legal Entities
  - Retry Contract: none
  - Pagination Contract: none
- `GET /org-units` - List Organizational Units
  - Retry Contract: none
  - Pagination Contract: none
- `POST /persons` - Create person
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /persons/{person-id}` - Delete person
  - Retry Contract: none
  - Pagination Contract: none
- `GET /persons/{id}` - Get person
  - Retry Contract: none
  - Pagination Contract: none
- `GET /persons` - List People
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /persons/{person-id}` - Update person
  - Retry Contract: none
  - Pagination Contract: none
- `POST /projects/{id}/members` - Add members to project
  - Retry Contract: none
  - Pagination Contract: none
- `POST /projects` - Create project
  - Retry Contract: none
  - Pagination Contract: none
- `GET /projects/{id}/members` - List project members
  - Retry Contract: none
  - Pagination Contract: none
- `GET /projects` - List projects
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /projects/{id}/members` - Remove project members
  - Retry Contract: none
  - Pagination Contract: none
- `GET /recruiting/applications` - List Recruiting Applications
  - Retry Contract: none
  - Pagination Contract: none
- `GET /recruiting/candidates` - List Candidates
  - Retry Contract: none
  - Pagination Contract: none
- `GET /recruiting/categories` - List Job Categories
  - Retry Contract: none
  - Pagination Contract: none
- `GET /recruiting/jobs` - List Open Positions
  - Retry Contract: none
  - Pagination Contract: none
- `GET /reports/{id}` - Get report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /reports` - List available reports
  - Retry Contract: none
  - Pagination Contract: none
- `POST /webhooks` - Create webhook
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /webhooks/{id}` - Delete webhook
  - Retry Contract: none
  - Pagination Contract: none
- `GET /webhooks/{id}/events` - Get webhook events
  - Retry Contract: none
  - Pagination Contract: none
- `GET /webhooks` - List webhooks
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /webhooks/{id}` - Update webhook
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Personio** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Personio** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Personio** display name.
