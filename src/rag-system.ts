import programInfo from '../data/program-info.json';
import { ProgramInfo } from './types';
import { logger } from './logger';

class RAGSystem {
  private programData: ProgramInfo;

  constructor() {
    this.programData = programInfo as ProgramInfo;
  }

  /**
   * Search for relevant information based on keywords in the user's question
   */
  getRelevantContext(question: string): string {
    const questionLower = question.toLowerCase();
    const contextParts: string[] = [];

    // Check for different types of questions and retrieve relevant sections

    // Dates and schedule
    if (this.matchesKeywords(questionLower, ['when', 'date', 'time', 'schedule', 'timeline', 'calendar'])) {
      contextParts.push(this.getScheduleContext());
    }

    // Next seminar/workshop
    if (this.matchesKeywords(questionLower, ['next', 'upcoming', 'seminar', 'workshop', 'session'])) {
      contextParts.push(this.getNextSessionContext());
    }

    // Zoom links
    if (this.matchesKeywords(questionLower, ['zoom', 'link', 'join', 'meeting', 'call'])) {
      contextParts.push(this.getZoomLinksContext());
    }

    // Program overview
    if (this.matchesKeywords(questionLower, ['overview', 'about', 'what is', 'program', 'intensive'])) {
      contextParts.push(this.getOverviewContext());
    }

    // Learning outcomes
    if (this.matchesKeywords(questionLower, ['learn', 'outcome', 'takeaway', 'goal', 'objective'])) {
      contextParts.push(this.getLearningOutcomesContext());
    }

    // Student criteria
    if (this.matchesKeywords(questionLower, ['criteria', 'requirement', 'qualify', 'eligible', 'who can', 'student'])) {
      contextParts.push(this.getStudentCriteriaContext());
    }

    // Application
    if (this.matchesKeywords(questionLower, ['apply', 'application', 'deadline', 'sign up', 'register'])) {
      contextParts.push(this.getApplicationContext());
    }

    // Workshop leads/advisors
    if (this.matchesKeywords(questionLower, ['advisor', 'lead', 'mina', 'mona', 'coach', 'instructor'])) {
      contextParts.push(this.getAdvisorsContext());
    }

    // Budget
    if (this.matchesKeywords(questionLower, ['budget', 'cost', 'price', 'fee'])) {
      contextParts.push(this.getBudgetContext());
    }

    // Resources/decks
    if (this.matchesKeywords(questionLower, ['deck', 'slide', 'resource', 'material', 'document'])) {
      contextParts.push(this.getResourcesContext());
    }

    // Time investment
    if (this.matchesKeywords(questionLower, ['time', 'hours', 'commitment', 'how long'])) {
      contextParts.push(this.getTimeInvestmentContext());
    }

    // Deliverables
    if (this.matchesKeywords(questionLower, ['deliverable', 'submit', 'turn in', 'homework', 'assignment'])) {
      contextParts.push(this.getDeliverablesContext());
    }

    // If no specific matches, return general overview
    if (contextParts.length === 0) {
      contextParts.push(this.getOverviewContext());
    }

    logger.debug('RAG context retrieved', { question, contextTypes: contextParts.length });

    return contextParts.join('\n\n');
  }

  /**
   * Check if question matches any of the keywords
   */
  private matchesKeywords(question: string, keywords: string[]): boolean {
    return keywords.some((keyword) => question.includes(keyword));
  }

  private getScheduleContext(): string {
    const curriculum = this.programData.curriculum;
    let context = 'CURRICULUM SCHEDULE:\n\n';
    curriculum.forEach((item) => {
      context += `${item.date}${item.time ? ` (${item.time})` : ''}: ${item.activity}\n`;
      if (item.details) {
        context += `  Details: ${item.details}\n`;
      }
    });
    return context;
  }

  private getNextSessionContext(): string {
    const curriculum = this.programData.curriculum;
    const upcomingSessions = curriculum.filter(
      (item) => item.activity.includes('Workshop') || item.activity.includes('Session')
    );

    let context = 'UPCOMING SESSIONS:\n\n';
    upcomingSessions.slice(0, 3).forEach((item) => {
      context += `${item.date}: ${item.activity}`;
      if (item.time) context += ` (${item.time})`;
      if (item.zoomLink || item.minaSchedule?.zoom || item.monaSchedule?.zoom) {
        context += '\n  Zoom: ' + (item.zoomLink || item.minaSchedule?.zoom || item.monaSchedule?.zoom);
      }
      context += '\n\n';
    });
    return context;
  }

  private getZoomLinksContext(): string {
    const zoom = this.programData.zoomLinks;
    let context = 'ZOOM LINKS:\n\n';
    context += `Mina's Zoom: ${zoom.mina} (short: ${zoom.minaShort})\n`;
    context += `Mona's Zoom: ${zoom.mona}\n`;
    context += `ROOLA Demo: ${zoom.roolaDemo}\n`;
    context += `ROOLA Inputs: ${zoom.roolaInputs}\n`;
    return context;
  }

  private getOverviewContext(): string {
    const program = this.programData.program;
    let context = 'PROGRAM OVERVIEW:\n\n';
    context += `Name: ${program.name}\n\n`;
    context += `${program.overview}\n\n`;
    context += 'KEY DATES:\n';
    Object.entries(program.keyDates).forEach(([key, value]) => {
      context += `  ${this.formatKey(key)}: ${value}\n`;
    });
    return context;
  }

  private getLearningOutcomesContext(): string {
    const outcomes = this.programData.program.learningOutcomes;
    let context = 'LEARNING OUTCOMES:\n\n';
    outcomes.forEach((outcome, index) => {
      context += `${index + 1}. ${outcome}\n`;
    });
    return context;
  }

  private getStudentCriteriaContext(): string {
    const criteria = this.programData.program.studentCriteria;
    let context = 'STUDENT CRITERIA:\n\n';
    Object.entries(criteria).forEach(([key, value]) => {
      context += `${this.formatKey(key)}:\n  ${value}\n\n`;
    });
    context += `Target number of students: ${this.programData.program.targetStudents}\n`;
    return context;
  }

  private getApplicationContext(): string {
    const app = this.programData.application;
    let context = 'APPLICATION INFORMATION:\n\n';
    context += `${app.description}\n\n`;
    context += `Deadline: ${app.deadline}\n`;
    context += `Application Form: ${app.formReference}\n\n`;
    context += 'CRITERIA:\n';
    app.criteria.forEach((criterion) => {
      context += `  - ${criterion}\n`;
    });
    return context;
  }

  private getAdvisorsContext(): string {
    const leads = this.programData.workshopLeads;
    let context = 'WORKSHOP LEADS & ADVISORS:\n\n';
    Object.entries(leads).forEach(([key, lead]) => {
      context += `${lead.name} - ${lead.role}\n`;
      if (lead.zoom) {
        context += `  Zoom: ${lead.zoom}\n`;
      }
      context += '\n';
    });
    return context;
  }

  private getBudgetContext(): string {
    const program = this.programData.program;
    let context = 'BUDGET INFORMATION:\n\n';
    context += `Total Budget: ${program.budget}\n`;
    context += `Budget Spreadsheet: ${program.budgetLink}\n`;
    return context;
  }

  private getResourcesContext(): string {
    const resources = this.programData.resources;
    let context = 'RESOURCES:\n\n';
    context += 'DECKS:\n';
    Object.entries(resources.decks).forEach(([key, url]) => {
      context += `  ${this.formatKey(key)}: ${url}\n`;
    });
    context += '\nDOCUMENTS:\n';
    Object.entries(resources.documents).forEach(([key, url]) => {
      context += `  ${this.formatKey(key)}: ${url}\n`;
    });
    context += '\nSPREADSHEETS:\n';
    Object.entries(resources.spreadsheets).forEach(([key, url]) => {
      context += `  ${this.formatKey(key)}: ${url}\n`;
    });
    return context;
  }

  private getTimeInvestmentContext(): string {
    const program = this.programData.program;
    let context = 'TIME INVESTMENT:\n\n';
    context += `Total: ${program.timeInvestment}\n\n`;
    context += 'STUDENT DELIVERABLES:\n';
    program.studentDeliverables.forEach((deliverable, index) => {
      context += `${index + 1}. ${deliverable}\n`;
    });
    return context;
  }

  private getDeliverablesContext(): string {
    const program = this.programData.program;
    let context = 'STUDENT DELIVERABLES:\n\n';
    program.studentDeliverables.forEach((deliverable, index) => {
      context += `${index + 1}. ${deliverable}\n`;
    });
    context += `\nTotal time investment: ${program.timeInvestment}\n`;
    return context;
  }

  private formatKey(key: string): string {
    // Convert camelCase to Title Case
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }

  /**
   * Get full program data as context (for complex queries)
   */
  getFullContext(): string {
    return JSON.stringify(this.programData, null, 2);
  }

  /**
   * Reload program data (useful after updates)
   */
  reloadData(): void {
    // Clear require cache and reload
    const path = '../data/program-info.json';
    delete require.cache[require.resolve(path)];
    this.programData = require(path) as ProgramInfo;
    logger.info('Program data reloaded');
  }
}

export default RAGSystem;
