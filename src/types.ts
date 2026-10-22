export interface ProgramInfo {
  program: {
    name: string;
    overview: string;
    keyDates: {
      sendApplications: string;
      applicationDeadline: string;
      selectAndNotify: string;
      preWorkStart: string;
      courseStart: string;
      courseEnd: string;
      presentationToPAV: string;
    };
    learningOutcomes: string[];
    measuresOfSuccess: string[];
    targetStudents: number;
    studentCriteria: {
      companyFit: string;
      businessMaturity: string;
      strategicReadiness: string;
      founderCommitment: string;
    };
    timeInvestment: string;
    studentDeliverables: string[];
    marketingPlan: string[];
    roles: {
      workshopLeads: string;
      pavStaff: string;
    };
    budget: string;
    budgetLink: string;
  };
  curriculum: CurriculumItem[];
  postCourse: string[];
  application: {
    formReference: string;
    deadline: string;
    description: string;
    criteria: string[];
    questions: string[];
  };
  workshopLeads: {
    mina: WorkshopLead;
    mona: WorkshopLead;
  };
  resources: {
    decks: Record<string, string>;
    documents: Record<string, string>;
    spreadsheets: Record<string, string>;
  };
  zoomLinks: {
    mina: string;
    minaShort: string;
    mona: string;
    roolaDemo: string;
    roolaInputs: string;
  };
}

export interface CurriculumItem {
  date: string;
  time?: string;
  activity: string;
  details?: string;
  homework?: string[];
  zoomLink?: string;
  resources?: {
    strategicPlanDemo?: string;
    growthReadinessReport?: string;
    inputsDemo?: string;
    demoPassword?: string;
  };
  agenda?: string[];
  signUpSheet?: string;
  minaSchedule?: {
    zoom: string;
    zoomShort?: string;
    slots: string[];
  };
  monaSchedule?: {
    zoom: string;
    slots: string[];
  };
  dueDate?: string;
}

export interface WorkshopLead {
  name: string;
  role: string;
  zoom: string;
  zoomShort?: string;
}

export interface SlackUserIdentity {
  userId: string;
  userName?: string;
  teamHint?: string;
}

export interface MiniMaxConfig {
  apiKey: string;
  groupId: string;
  apiUrl: string;
}

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  channelId: string;
}

export interface ReminderConfig {
  applicationDeadline: string;
  preWorkStart: string;
  courseStart: string;
  presentationDate: string;
  timezone: string;
}

export interface ScheduledReminder {
  type: 'applicationDeadline' | 'preWorkStart' | 'workshop' | 'presentation' | 'weeklyCheckin' | 'feedback';
  date: string;
  message: string;
  targetChannel?: string;
  targetUsers?: string[];
}
