import * as DbTypes from './db-types';


// ----

interface SiteAlertSeverityInfo {
    readonly id: number;
    readonly label: DbTypes.SiteAlertSeverityLabel;
}

const SEVERITIES: {[s: string]: SiteAlertSeverityInfo} = {
    info : {
        id : 1,
        label : 'info',
    },
    warning : {
        id : 2,
        label : 'warning',
    },
    error : {
        id : 3,
        label : 'error',
    },
};

const severitiesById: {[id: number]: SiteAlertSeverityInfo} = {};
Object.keys(SEVERITIES).forEach((label) => {
    const severity = SEVERITIES[label];
    severitiesById[severity.id] = severity;
});

const severityLabels: string[] = Object.keys(SEVERITIES);
const severitiesByLabel = SEVERITIES;

// ----

interface SiteAlertAudienceInfo {
    readonly id: number;
    readonly label: DbTypes.SiteAlertAudienceLabel;
}

const AUDIENCES: {[s: string]: SiteAlertAudienceInfo} = {
    // IMPORTANT! These are in numerical order of restrictiveness
    //  so a supervisor (3) can see anything for public (1) or student (2)
    //  and a student (2) can see anything for public (1) but not anything for supervisors (3)

    public : {
        id : 1,
        label : 'public',
    },
    student : {
        id : 2,
        label : 'student',
    },
    supervisor : {
        id : 3,
        label : 'supervisor',
    },
};

const audiencesById: {[id: number]: SiteAlertAudienceInfo} = {};
Object.keys(AUDIENCES).forEach((label) => {
    const audience = AUDIENCES[label];
    audiencesById[audience.id] = audience;
});

const audienceLabels: string[] = Object.keys(AUDIENCES);
const audiencesByLabel = AUDIENCES;


export {
    severityLabels, severitiesById, severitiesByLabel,
    audienceLabels, audiencesById,  audiencesByLabel,
};
