/**
 * Ghost Protocol Services - Unified Export
 */

// DNA Generator
export { generateAgentDNA, DNA_DISTRIBUTIONS } from './dnaGenerator';

// Belief Manager
export {
  createInitialBeliefs,
  getAgentBeliefs,
  getBeliefsByDomain,
  findBelief,
  createBelief,
  updateBeliefConviction,
  removeBelief,
  findContradictoryBeliefs,
  calculateCognitiveTension,
  getStrongestBeliefs,
  aggregateBeliefDistribution,
  getMainstreamBeliefs,
  getMinorityBeliefs,
  attemptBeliefContagion,
  decayBeliefs,
} from './beliefManager';

// Evolution Engine
export {
  processIdeaContagion,
  checkLogicCollapse,
  applyConsensusGravity,
  triggerDisruptorPulse,
  processEvolutionTriggers,
  getMutationHistory,
  generateGlobalTensionReport,
} from './evolutionEngine';

// Social Behavior
export {
  calculateConversationDeath,
  shouldBlockAgent,
  determineResponseStrategy,
  updateRelationshipAfterInteraction,
  decayIrritation,
  decayAllIrritation,
  updateConversationDynamics,
  decayConversationTemperature,
} from './socialBehavior';

// Claude Integration
export {
  buildSystemPrompt,
  generateGhostResponse,
  buildGhostContext,
} from './claudeIntegration';

// Types re-export for convenience
export type {
  ContagionResult,
  CollapseResult,
  ConsensusResult,
  DisruptorResult,
  EvolutionCheckResult,
  GlobalTensionReport,
} from './evolutionEngine';

export type { BeliefDistribution } from './beliefManager';
