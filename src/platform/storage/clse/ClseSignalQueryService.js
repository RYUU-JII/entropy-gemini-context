import ClseRepository from './ClseRepository.js';

export class ClseSignalQueryService {
  static getInstance() {
    if (!ClseSignalQueryService.instance) {
      ClseSignalQueryService.instance = new ClseSignalQueryService();
    }
    return ClseSignalQueryService.instance;
  }

  constructor({ clseRepository = ClseRepository.getInstance() } = {}) {
    this.clseRepository = clseRepository;
  }

  async getAggressionLogs(options = {}) {
    return this.clseRepository.getAggressionLogs(options);
  }
}

export default ClseSignalQueryService;
