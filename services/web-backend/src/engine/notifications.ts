/* ------------------------------------------------------------------ */
/*  Engine → Backend notification dispatcher                           */
/*                                                                     */
/*  Called by game-flow.ts when game events occur.  Dispatches to the  */
/*  appropriate handler (socket.io broadcast, DB persistence, etc.).   */
/* ------------------------------------------------------------------ */

import logger from '../lib/logger.js'
import { handleQuestionFinished, handleNextQuestion, handleGameFinished } from '../controllers/room-events.js'
import { handleReceiveResults } from '../controllers/results.js'
import type { QuestionFinishedPayload, NextQuestionPayload, ResultsPayload } from './types.js'

/**
 * Dispatch a game event notification to the backend.
 *
 * @param roomId  The room the event belongs to.
 * @param event   Event name (e.g. "question-finished", "next-question").
 * @param payload Optional event payload.
 */
export async function notifyBackend(
  roomId: string,
  event: string,
  payload?: unknown,
): Promise<void> {
  try {
    switch (event) {
      case 'question-finished': {
        handleQuestionFinished(roomId, payload as QuestionFinishedPayload)
        break
      }
      case 'next-question': {
        handleNextQuestion(roomId, payload as NextQuestionPayload)
        break
      }
      case 'game-finished': {
        handleGameFinished(roomId)
        break
      }
      case 'results': {
        const data = payload as ResultsPayload
        await handleReceiveResults(roomId, data.scores, data.answers)
        break
      }
      default:
        logger.warn({ event, roomId }, 'Unknown engine notification event')
    }
  } catch (err) {
    logger.error({ err, event, roomId }, 'Engine notification failed')
  }
}
