import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Personio implements INodeType {
  description: INodeTypeDescription = {
        displayName: "Personio",
        name: "personio",
        icon: {
            light: "file:personio.svg",
            dark: "file:personio.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{((JSON.parse(\"\\u007b\\\"absences\\\":\\u007b\\\"createAbsencePeriod\\\":\\\"createAbsencePeriod: absence\\\",\\\"deleteAbsencePeriod\\\":\\\"deleteAbsencePeriod: absence\\\",\\\"getAbsenceBreakdowns\\\":\\\"getDailyAbsenceBreakdowns: absence\\\",\\\"getAbsencePeriod\\\":\\\"getAbsencePeriod: absence\\\",\\\"listAbsencePeriods\\\":\\\"listAbsencePeriods: absence\\\",\\\"listAbsenceTypes\\\":\\\"listAbsenceTypes: absence\\\",\\\"updateAbsencePeriod\\\":\\\"updateAbsencePeriod: absence\\\"\\u007d,\\\"attendance\\\":\\u007b\\\"createAttendancePeriod\\\":\\\"createAttendancePeriod: attendance\\\",\\\"deleteAttendancePeriod\\\":\\\"deleteAttendancePeriod: attendance\\\",\\\"getAttendancePeriod\\\":\\\"getAttendancePeriod: attendance\\\",\\\"listAttendancePeriods\\\":\\\"listAttendancePeriods: attendance\\\",\\\"updateAttendancePeriod\\\":\\\"updateAttendancePeriod: attendance\\\"\\u007d,\\\"compensation\\\":\\u007b\\\"createCompensation\\\":\\\"createCompensationRecord: compensation\\\",\\\"createCompensationType\\\":\\\"createCompensationType: compensation\\\",\\\"listCompensationTypes\\\":\\\"listCompensationTypes: compensation\\\",\\\"listCompensations\\\":\\\"listCompensationRecords: compensation\\\"\\u007d,\\\"employments\\\":\\u007b\\\"getEmployment\\\":\\\"getEmployment: employment\\\",\\\"listEmployments\\\":\\\"listAPersonSEmployments: employment\\\",\\\"updateEmployment\\\":\\\"updateEmployment: employment\\\"\\u007d,\\\"organization\\\":\\u007b\\\"listLegalEntities\\\":\\\"listLegalEntities: organization\\\",\\\"listOrgUnits\\\":\\\"listOrganizationalUnits: organization\\\"\\u007d,\\\"persons\\\":\\u007b\\\"createPerson\\\":\\\"createPerson: person\\\",\\\"deletePerson\\\":\\\"deletePerson: person\\\",\\\"getPerson\\\":\\\"getPerson: person\\\",\\\"listPersons\\\":\\\"listPeople: person\\\",\\\"updatePerson\\\":\\\"updatePerson: person\\\"\\u007d,\\\"projects\\\":\\u007b\\\"addProjectMembers\\\":\\\"addMembersToProject: project\\\",\\\"createProject\\\":\\\"createProject: project\\\",\\\"listProjectMembers\\\":\\\"listProjectMembers: project\\\",\\\"listProjects\\\":\\\"listProjects: project\\\",\\\"removeProjectMembers\\\":\\\"removeProjectMembers: project\\\"\\u007d,\\\"recruiting\\\":\\u007b\\\"listApplications\\\":\\\"listRecruitingApplications: recruiting\\\",\\\"listCandidates\\\":\\\"listCandidates: recruiting\\\",\\\"listJobCategories\\\":\\\"listJobCategories: recruiting\\\",\\\"listJobs\\\":\\\"listOpenPositions: recruiting\\\"\\u007d,\\\"reports\\\":\\u007b\\\"getReport\\\":\\\"getReport: report\\\",\\\"listReports\\\":\\\"listAvailableReports: report\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
        description: "Personio helps HR teams manage people data, time, talent, and everyday HR workflows.",
        documentationUrl: "https://api.personio.de/v2",
        defaults: {
            name: "Personio"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "personioApi",
                required: true
            }
        ],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "absences",
                options: [
                    {
                        name: "Absence",
                        value: "absences"
                    },
                    {
                        name: "Attendance",
                        value: "attendance"
                    },
                    {
                        name: "Compensation",
                        value: "compensation"
                    },
                    {
                        name: "Employment",
                        value: "employments"
                    },
                    {
                        name: "Organization",
                        value: "organization"
                    },
                    {
                        name: "Person",
                        value: "persons"
                    },
                    {
                        name: "Project",
                        value: "projects"
                    },
                    {
                        name: "Recruiting",
                        value: "recruiting"
                    },
                    {
                        name: "Report",
                        value: "reports"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ]
                    }
                },
                default: "createAbsencePeriod",
                options: [
                    {
                        name: "Create Absence Period",
                        value: "createAbsencePeriod",
                        action: "Create absence period",
                        description: "Create an absence period for a person"
                    },
                    {
                        name: "Delete Absence Period",
                        value: "deleteAbsencePeriod",
                        action: "Delete absence period",
                        description: "Delete an absence period by ID"
                    },
                    {
                        name: "Get Absence Period",
                        value: "getAbsencePeriod",
                        action: "Get absence period",
                        description: "Retrieve an absence period by ID"
                    },
                    {
                        name: "Get Daily Absence Breakdowns",
                        value: "getAbsenceBreakdowns",
                        action: "Get daily absence breakdowns",
                        description: "Retrieve daily breakdowns for an absence period"
                    },
                    {
                        name: "List Absence Periods",
                        value: "listAbsencePeriods",
                        action: "List absence periods",
                        description: "List absence periods in personio"
                    },
                    {
                        name: "List Absence Types",
                        value: "listAbsenceTypes",
                        action: "List absence types",
                        description: "List absence types available in personio"
                    },
                    {
                        name: "Update Absence Period",
                        value: "updateAbsencePeriod",
                        action: "Update absence period",
                        description: "Update an absence period by ID"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "createAbsencePeriod"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Absence Type ID",
                        name: "absence_type_id",
                        type: "string",
                        default: "",
                        description: "ID of the absence type"
                    },
                    {
                        displayName: "End Date",
                        name: "end_date",
                        type: "string",
                        default: "",
                        description: "Last day of the absence in `yyyy-mm-dd` format"
                    },
                    {
                        displayName: "Person ID",
                        name: "person_id",
                        type: "string",
                        default: "",
                        description: "ID of the person associated with the absence"
                    },
                    {
                        displayName: "Start Date",
                        name: "start_date",
                        type: "string",
                        default: "",
                        description: "First day of the absence in `yyyy-mm-dd` format"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Absence period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "deleteAbsencePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Absence period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "getAbsenceBreakdowns"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Absence period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "getAbsencePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Absence period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "updateAbsencePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "absences"
                        ],
                        operation: [
                            "updateAbsencePeriod"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Absence Type ID",
                        name: "absence_type_id",
                        type: "string",
                        default: "",
                        description: "ID of the absence type"
                    },
                    {
                        displayName: "End Date",
                        name: "end_date",
                        type: "string",
                        default: "",
                        description: "Last day of the absence in `yyyy-mm-dd` format"
                    },
                    {
                        displayName: "Person ID",
                        name: "person_id",
                        type: "string",
                        default: "",
                        description: "ID of the person associated with the absence"
                    },
                    {
                        displayName: "Start Date",
                        name: "start_date",
                        type: "string",
                        default: "",
                        description: "First day of the absence in `yyyy-mm-dd` format"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ]
                    }
                },
                default: "createAttendancePeriod",
                options: [
                    {
                        name: "Create Attendance Period",
                        value: "createAttendancePeriod",
                        action: "Create attendance period",
                        description: "Create an attendance period for a person"
                    },
                    {
                        name: "Delete Attendance Period",
                        value: "deleteAttendancePeriod",
                        action: "Delete attendance period",
                        description: "Delete an attendance period by ID"
                    },
                    {
                        name: "Get Attendance Period",
                        value: "getAttendancePeriod",
                        action: "Get attendance period",
                        description: "Retrieve an attendance period by ID"
                    },
                    {
                        name: "List Attendance Periods",
                        value: "listAttendancePeriods",
                        action: "List attendance periods",
                        description: "List attendance periods in personio"
                    },
                    {
                        name: "Update Attendance Period",
                        value: "updateAttendancePeriod",
                        action: "Update attendance period",
                        description: "Update an attendance period by ID"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ],
                        operation: [
                            "createAttendancePeriod"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End",
                        name: "end",
                        type: "dateTime",
                        default: "",
                        description: "Attendance end date and time"
                    },
                    {
                        displayName: "Person ID",
                        name: "person_id",
                        type: "string",
                        default: "",
                        description: "ID of the person associated with the attendance"
                    },
                    {
                        displayName: "Start",
                        name: "start",
                        type: "dateTime",
                        default: "",
                        description: "Attendance start date and time"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Attendance period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ],
                        operation: [
                            "deleteAttendancePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Attendance period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ],
                        operation: [
                            "getAttendancePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Attendance period ID",
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ],
                        operation: [
                            "updateAttendancePeriod"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "attendance"
                        ],
                        operation: [
                            "updateAttendancePeriod"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End",
                        name: "end",
                        type: "dateTime",
                        default: "",
                        description: "Attendance end date and time"
                    },
                    {
                        displayName: "Person ID",
                        name: "person_id",
                        type: "string",
                        default: "",
                        description: "ID of the person associated with the attendance"
                    },
                    {
                        displayName: "Start",
                        name: "start",
                        type: "dateTime",
                        default: "",
                        description: "Attendance start date and time"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "compensation"
                        ]
                    }
                },
                default: "createCompensation",
                options: [
                    {
                        name: "Create Compensation Record",
                        value: "createCompensation",
                        action: "Create compensation record",
                        description: "Create a compensation record for a person"
                    },
                    {
                        name: "Create Compensation Type",
                        value: "createCompensationType",
                        action: "Create compensation type",
                        description: "Create a compensation type"
                    },
                    {
                        name: "List Compensation Records",
                        value: "listCompensations",
                        action: "List compensation records",
                        description: "List compensation records in personio"
                    },
                    {
                        name: "List Compensation Types",
                        value: "listCompensationTypes",
                        action: "List compensation types",
                        description: "List compensation types available in personio"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "compensation"
                        ],
                        operation: [
                            "createCompensation"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Amount",
                        name: "amount",
                        type: "number",
                        default: 0,
                        description: "Compensation amount"
                    },
                    {
                        displayName: "Currency",
                        name: "currency",
                        type: "string",
                        default: "",
                        description: "Currency for the compensation amount"
                    },
                    {
                        displayName: "Person ID",
                        name: "person_id",
                        type: "string",
                        default: "",
                        description: "ID of the person associated with the compensation"
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Raw request body",
                displayOptions: {
                    show: {
                        resource: [
                            "compensation"
                        ],
                        operation: [
                            "createCompensationType"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ]
                    }
                },
                default: "getEmployment",
                options: [
                    {
                        name: "Get",
                        value: "getEmployment",
                        action: "Get employment",
                        description: "Retrieve an employment record for a person"
                    },
                    {
                        name: "List A Person'S",
                        value: "listEmployments",
                        action: "List person s employments",
                        description: "List employment records for a person"
                    },
                    {
                        name: "Update",
                        value: "updateEmployment",
                        action: "Update employment",
                        description: "Update an employment record for a person"
                    }
                ]
            },
            {
                displayName: "Person ID",
                name: "person-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "getEmployment"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Employment ID",
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "getEmployment"
                        ]
                    }
                }
            },
            {
                displayName: "Person ID",
                name: "person-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "listEmployments"
                        ]
                    }
                }
            },
            {
                displayName: "Person ID",
                name: "person-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "updateEmployment"
                        ]
                    }
                }
            },
            {
                displayName: "Employment ID",
                name: "employment-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "updateEmployment"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "employments"
                        ],
                        operation: [
                            "updateEmployment"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Position",
                        name: "position",
                        type: "string",
                        default: "",
                        description: "Position recorded for the employment"
                    },
                    {
                        displayName: "Start Date",
                        name: "start_date",
                        type: "string",
                        default: "",
                        description: "Employment start date in `yyyy-mm-dd` format"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "organization"
                        ]
                    }
                },
                default: "listLegalEntities",
                options: [
                    {
                        name: "List Legal Entities",
                        value: "listLegalEntities",
                        action: "List legal entities organization",
                        description: "List legal entities in personio. organization."
                    },
                    {
                        name: "List Organizational Units",
                        value: "listOrgUnits",
                        action: "List organizational units",
                        description: "List organizational units in personio"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ]
                    }
                },
                default: "createPerson",
                options: [
                    {
                        name: "Create",
                        value: "createPerson",
                        action: "Create person",
                        description: "Create a person and an associated employment record"
                    },
                    {
                        name: "Delete",
                        value: "deletePerson",
                        action: "Delete person",
                        description: "Delete a person by ID"
                    },
                    {
                        name: "Get",
                        value: "getPerson",
                        action: "Get person",
                        description: "Retrieve a person by ID"
                    },
                    {
                        name: "List People",
                        value: "listPersons",
                        action: "List people persons",
                        description: "List people in personio. use `status` to filter by `active` or `inactive`."
                    },
                    {
                        name: "Update",
                        value: "updatePerson",
                        action: "Update person",
                        description: "Update a person by ID"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "createPerson"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Email",
                        name: "email",
                        type: "string",
                        default: "",
                        description: "Person's email address",
                        placeholder: "name@email.com"
                    },
                    {
                        displayName: "First Name",
                        name: "first_name",
                        type: "string",
                        default: "",
                        description: "Person's first name"
                    },
                    {
                        displayName: "Last Name",
                        name: "last_name",
                        type: "string",
                        default: "",
                        description: "Person's last name"
                    }
                ]
            },
            {
                displayName: "Person ID",
                name: "person-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "deletePerson"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Person ID",
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "getPerson"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "listPersons"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "ACTIVE",
                        description: "Filter people by status: `active` or `inactive`",
                        options: [
                            {
                                name: "ACTIVE",
                                value: "ACTIVE"
                            },
                            {
                                name: "INACTIVE",
                                value: "INACTIVE"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "Person ID",
                name: "person-id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "updatePerson"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "persons"
                        ],
                        operation: [
                            "updatePerson"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Email",
                        name: "email",
                        type: "string",
                        default: "",
                        description: "Person's email address",
                        placeholder: "name@email.com"
                    },
                    {
                        displayName: "First Name",
                        name: "first_name",
                        type: "string",
                        default: "",
                        description: "Person's first name"
                    },
                    {
                        displayName: "Last Name",
                        name: "last_name",
                        type: "string",
                        default: "",
                        description: "Person's last name"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ]
                    }
                },
                default: "addProjectMembers",
                options: [
                    {
                        name: "Add Members To",
                        value: "addProjectMembers",
                        action: "Add members to project",
                        description: "Add people to a project using their personio member IDs"
                    },
                    {
                        name: "Create",
                        value: "createProject",
                        action: "Create project",
                        description: "Create a project"
                    },
                    {
                        name: "List",
                        value: "listProjects",
                        action: "List projects",
                        description: "List projects in personio"
                    },
                    {
                        name: "List Project Members",
                        value: "listProjectMembers",
                        action: "List project members",
                        description: "List members assigned to a project"
                    },
                    {
                        name: "Remove Project Members",
                        value: "removeProjectMembers",
                        action: "Remove project members",
                        description: "Remove members from a project"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Project ID",
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ],
                        operation: [
                            "addProjectMembers"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ],
                        operation: [
                            "addProjectMembers"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Member IDs",
                        name: "member_ids",
                        type: "json",
                        default: [],
                        description: "IDs of the people to add to the project"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ],
                        operation: [
                            "createProject"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Description",
                        name: "description",
                        type: "string",
                        default: "",
                        description: "Project description"
                    },
                    {
                        displayName: "Name",
                        name: "name",
                        type: "string",
                        default: "",
                        description: "Project name"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Project ID",
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ],
                        operation: [
                            "listProjectMembers"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Project ID",
                displayOptions: {
                    show: {
                        resource: [
                            "projects"
                        ],
                        operation: [
                            "removeProjectMembers"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "recruiting"
                        ]
                    }
                },
                default: "listApplications",
                options: [
                    {
                        name: "List Candidates",
                        value: "listCandidates",
                        action: "List candidates recruiting",
                        description: "List recruiting candidates"
                    },
                    {
                        name: "List Job Categories",
                        value: "listJobCategories",
                        action: "List job categories recruiting",
                        description: "List recruiting job categories"
                    },
                    {
                        name: "List Open Positions",
                        value: "listJobs",
                        action: "List open positions recruiting",
                        description: "List open recruiting positions"
                    },
                    {
                        name: "List Recruiting Applications",
                        value: "listApplications",
                        action: "List recruiting applications"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reports"
                        ]
                    }
                },
                default: "getReport",
                options: [
                    {
                        name: "Get",
                        value: "getReport",
                        action: "Get report",
                        description: "Retrieve a report by ID"
                    },
                    {
                        name: "List Available",
                        value: "listReports",
                        action: "List available reports",
                        description: "List available reports in personio"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Report ID",
                displayOptions: {
                    show: {
                        resource: [
                            "reports"
                        ],
                        operation: [
                            "getReport"
                        ]
                    }
                }
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "createAbsencePeriod": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/absence-periods";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["absence_type_id"] !== undefined) setBodyField(body as IDataObject, {"name":"absence_type_id","displayName":"Absence type id","description":"ID of the absence type.","type":"string"}, additionalFields["absence_type_id"], this, itemIndex);
    if (additionalFields["end_date"] !== undefined) setBodyField(body as IDataObject, {"name":"end_date","displayName":"End date","description":"Last day of the absence in `YYYY-MM-DD` format.","type":"string","format":"date"}, additionalFields["end_date"], this, itemIndex);
    if (additionalFields["person_id"] !== undefined) setBodyField(body as IDataObject, {"name":"person_id","displayName":"Person id","description":"ID of the person associated with the absence.","type":"string"}, additionalFields["person_id"], this, itemIndex);
    if (additionalFields["start_date"] !== undefined) setBodyField(body as IDataObject, {"name":"start_date","displayName":"Start date","description":"First day of the absence in `YYYY-MM-DD` format.","type":"string","format":"date"}, additionalFields["start_date"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["end_date","id","person_id","start_date","status"], simplified: ["end_date","id","person_id","start_date","status"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "deleteAbsencePeriod": {
        
        
        let path = "/absence-periods/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getAbsenceBreakdowns": {
        
        
        let path = "/absence-periods/{id}/breakdowns";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getAbsencePeriod": {
        
        
        let path = "/absence-periods/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["end_date","id","person_id","start_date","status"], simplified: ["end_date","id","person_id","start_date","status"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listAbsencePeriods": {
        
        
        const path = "/absence-periods";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listAbsenceTypes": {
        
        
        const path = "/absence-types";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateAbsencePeriod": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/absence-periods/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["absence_type_id"] !== undefined) setBodyField(body as IDataObject, {"name":"absence_type_id","displayName":"Absence type id","description":"ID of the absence type.","type":"string"}, additionalFields["absence_type_id"], this, itemIndex);
    if (additionalFields["end_date"] !== undefined) setBodyField(body as IDataObject, {"name":"end_date","displayName":"End date","description":"Last day of the absence in `YYYY-MM-DD` format.","type":"string","format":"date"}, additionalFields["end_date"], this, itemIndex);
    if (additionalFields["person_id"] !== undefined) setBodyField(body as IDataObject, {"name":"person_id","displayName":"Person id","description":"ID of the person associated with the absence.","type":"string"}, additionalFields["person_id"], this, itemIndex);
    if (additionalFields["start_date"] !== undefined) setBodyField(body as IDataObject, {"name":"start_date","displayName":"Start date","description":"First day of the absence in `YYYY-MM-DD` format.","type":"string","format":"date"}, additionalFields["start_date"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["end_date","id","person_id","start_date","status"], simplified: ["end_date","id","person_id","start_date","status"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createAttendancePeriod": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/attendance-periods";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["end"] !== undefined) setBodyField(body as IDataObject, {"name":"end","displayName":"End","description":"Attendance end date and time.","type":"string","format":"date-time"}, additionalFields["end"], this, itemIndex);
    if (additionalFields["person_id"] !== undefined) setBodyField(body as IDataObject, {"name":"person_id","displayName":"Person id","description":"ID of the person associated with the attendance.","type":"string"}, additionalFields["person_id"], this, itemIndex);
    if (additionalFields["start"] !== undefined) setBodyField(body as IDataObject, {"name":"start","displayName":"Start","description":"Attendance start date and time.","type":"string","format":"date-time"}, additionalFields["start"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "deleteAttendancePeriod": {
        
        
        let path = "/attendance-periods/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getAttendancePeriod": {
        
        
        let path = "/attendance-periods/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listAttendancePeriods": {
        
        
        const path = "/attendance-periods";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateAttendancePeriod": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/attendance-periods/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["end"] !== undefined) setBodyField(body as IDataObject, {"name":"end","displayName":"End","description":"Attendance end date and time.","type":"string","format":"date-time"}, additionalFields["end"], this, itemIndex);
    if (additionalFields["person_id"] !== undefined) setBodyField(body as IDataObject, {"name":"person_id","displayName":"Person id","description":"ID of the person associated with the attendance.","type":"string"}, additionalFields["person_id"], this, itemIndex);
    if (additionalFields["start"] !== undefined) setBodyField(body as IDataObject, {"name":"start","displayName":"Start","description":"Attendance start date and time.","type":"string","format":"date-time"}, additionalFields["start"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createAccessToken": {
        
        
        const path = "/auth/token";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"client_id","displayName":"Client id","description":"OAuth client identifier.","type":"string","required":true}, this.getNodeParameter("client_id", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"client_secret","displayName":"Client secret","description":"Secret associated with the OAuth client.","type":"string","required":true}, this.getNodeParameter("client_secret", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Invalid credentials"}};
        break;
      }
    case "revokeAccessToken": {
        
        
        const path = "/auth/revoke";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createCompensation": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/compensations";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["amount"] !== undefined) setBodyField(body as IDataObject, {"name":"amount","displayName":"Amount","description":"Compensation amount.","type":"number"}, additionalFields["amount"], this, itemIndex);
    if (additionalFields["currency"] !== undefined) setBodyField(body as IDataObject, {"name":"currency","displayName":"Currency","description":"Currency for the compensation amount.","type":"string"}, additionalFields["currency"], this, itemIndex);
    if (additionalFields["person_id"] !== undefined) setBodyField(body as IDataObject, {"name":"person_id","displayName":"Person id","description":"ID of the person associated with the compensation.","type":"string"}, additionalFields["person_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createCompensationType": {
        
        
        const path = "/compensations/types";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Raw request body","representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listCompensationTypes": {
        
        
        const path = "/compensations/types";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listCompensations": {
        
        
        const path = "/compensations";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "downloadDocument": {
        
        
        let path = "/document-management/documents/{id}/download";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listDocuments": {
        
        
        const path = "/document-management/documents";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getEmployment": {
        
        
        let path = "/persons/{person-id}/employments/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{person-id}").join(encodeURIComponent(String(this.getNodeParameter("person-id", itemIndex))));
    path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listEmployments": {
        
        
        let path = "/persons/{person-id}/employments";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{person-id}").join(encodeURIComponent(String(this.getNodeParameter("person-id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateEmployment": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/persons/{person-id}/employments/{employment-id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{person-id}").join(encodeURIComponent(String(this.getNodeParameter("person-id", itemIndex))));
    path = path.split("{employment-id}").join(encodeURIComponent(String(this.getNodeParameter("employment-id", itemIndex))));
        if (additionalFields["position"] !== undefined) setBodyField(body as IDataObject, {"name":"position","displayName":"Position","description":"Position recorded for the employment.","type":"string"}, additionalFields["position"], this, itemIndex);
    if (additionalFields["start_date"] !== undefined) setBodyField(body as IDataObject, {"name":"start_date","displayName":"Start date","description":"Employment start date in `YYYY-MM-DD` format.","type":"string","format":"date"}, additionalFields["start_date"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listLegalEntities": {
        
        
        const path = "/legal-entities";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listOrgUnits": {
        
        
        const path = "/org-units";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createPerson": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/persons";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["email"] !== undefined) setBodyField(body as IDataObject, {"name":"email","displayName":"Email","description":"Person's email address.","type":"string"}, additionalFields["email"], this, itemIndex);
    if (additionalFields["first_name"] !== undefined) setBodyField(body as IDataObject, {"name":"first_name","displayName":"First name","description":"Person's first name.","type":"string"}, additionalFields["first_name"], this, itemIndex);
    if (additionalFields["last_name"] !== undefined) setBodyField(body as IDataObject, {"name":"last_name","displayName":"Last name","description":"Person's last name.","type":"string"}, additionalFields["last_name"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "deletePerson": {
        
        
        let path = "/persons/{person-id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{person-id}").join(encodeURIComponent(String(this.getNodeParameter("person-id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getPerson": {
        
        
        let path = "/persons/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listPersons": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/persons";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "updatePerson": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/persons/{person-id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{person-id}").join(encodeURIComponent(String(this.getNodeParameter("person-id", itemIndex))));
        if (additionalFields["email"] !== undefined) setBodyField(body as IDataObject, {"name":"email","displayName":"Email","description":"Person's email address.","type":"string"}, additionalFields["email"], this, itemIndex);
    if (additionalFields["first_name"] !== undefined) setBodyField(body as IDataObject, {"name":"first_name","displayName":"First name","description":"Person's first name.","type":"string"}, additionalFields["first_name"], this, itemIndex);
    if (additionalFields["last_name"] !== undefined) setBodyField(body as IDataObject, {"name":"last_name","displayName":"Last name","description":"Person's last name.","type":"string"}, additionalFields["last_name"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","success"], simplified: ["data","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "addProjectMembers": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/projects/{id}/members";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["member_ids"] !== undefined) setBodyField(body as IDataObject, {"name":"member_ids","displayName":"Member ids","description":"IDs of the people to add to the project.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["member_ids"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createProject": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/projects";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["description"] !== undefined) setBodyField(body as IDataObject, {"name":"description","displayName":"Description","description":"Project description.","type":"string"}, additionalFields["description"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","description":"Project name.","type":"string"}, additionalFields["name"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listProjectMembers": {
        
        
        let path = "/projects/{id}/members";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listProjects": {
        
        
        const path = "/projects";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "removeProjectMembers": {
        
        
        let path = "/projects/{id}/members";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listApplications": {
        
        
        const path = "/recruiting/applications";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listCandidates": {
        
        
        const path = "/recruiting/candidates";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listJobCategories": {
        
        
        const path = "/recruiting/categories";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listJobs": {
        
        
        const path = "/recruiting/jobs";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getReport": {
        
        
        let path = "/reports/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listReports": {
        
        
        const path = "/reports";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "createWebhook": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/webhooks";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["events"] !== undefined) setBodyField(body as IDataObject, {"name":"events","displayName":"Events","description":"Event names that trigger webhook deliveries.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["events"], this, itemIndex);
    if (additionalFields["url"] !== undefined) setBodyField(body as IDataObject, {"name":"url","displayName":"Url","description":"HTTPS endpoint Personio calls when a subscribed event occurs.","type":"string"}, additionalFields["url"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "deleteWebhook": {
        
        
        let path = "/webhooks/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getWebhookEvents": {
        
        
        let path = "/webhooks/{id}/events";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "listWebhooks": {
        
        
        const path = "/webhooks";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateWebhook": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/webhooks/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["events"] !== undefined) setBodyField(body as IDataObject, {"name":"events","displayName":"Events","description":"Event names that trigger webhook deliveries.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["events"], this, itemIndex);
    if (additionalFields["url"] !== undefined) setBodyField(body as IDataObject, {"name":"url","displayName":"Url","description":"HTTPS endpoint Personio calls when a subscribed event occurs.","type":"string"}, additionalFields["url"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.personio.de/v2", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"personioApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
