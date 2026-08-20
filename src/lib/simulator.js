// Simulator Engine for Round-wise and Allocation Analytics
// Because the database only stores the final cutoff score, we use this engine
// to simulate the round-by-round shifts based on historical drop rates.

/**
 * Simulates round-wise cutoff scores given a base final cutoff score.
 * A higher score means it is harder to get in (R1 > R2 > R3).
 * 
 * @param {number} baseScore - The final cutoff score from the database.
 * @returns {Object} - The simulated cutoffs for each round.
 */
export function simulateRoundCutoffs(baseScore) {
  if (baseScore == null) return null;
  
  // Historical average drop in scores across rounds
  return {
    r1: Math.min(720, baseScore + 15),
    r2: Math.min(720, baseScore + 8),
    r3: Math.min(720, baseScore + 3),
    mopUp: baseScore
  };
}

/**
 * Determines the user's allocation status based on their score and the simulated rounds.
 * 
 * @param {number} userScore - The user's NEET score.
 * @param {number} baseScore - The final cutoff score from the database.
 * @returns {Object} - Detailed status object for the timeline UI.
 */
export function calculateAllocationStatus(userScore, baseScore) {
  if (baseScore == null || userScore == null) return null;
  
  const rounds = simulateRoundCutoffs(baseScore);
  
  let overallProbability = 'low';
  let overallPercentage = 15;
  let securedRound = null;
  
  if (userScore >= rounds.r1) {
    overallProbability = 'high';
    overallPercentage = 95;
    securedRound = 'r1';
  } else if (userScore >= rounds.r2) {
    overallProbability = 'high';
    overallPercentage = 85;
    securedRound = 'r2';
  } else if (userScore >= rounds.r3) {
    overallProbability = 'borderline';
    overallPercentage = 60;
    securedRound = 'r3';
  } else if (userScore >= rounds.mopUp) {
    overallProbability = 'borderline';
    overallPercentage = 40;
    securedRound = 'mopUp';
  } else if (userScore >= rounds.mopUp - 10) {
    overallProbability = 'low';
    overallPercentage = 15;
    securedRound = 'none_close';
  } else {
    overallProbability = 'low';
    overallPercentage = 5;
    securedRound = 'none';
  }

  return {
    rounds,
    overallProbability,
    overallPercentage,
    securedRound,
    // Provide specific timeline messages
    timeline: {
      r1: {
        status: userScore >= rounds.r1 ? 'Secured' : 'Waitlisted',
        title: userScore >= rounds.r1 ? 'High Probability Seat Allotment' : 'Unlikely (Waitlisted)',
        desc: userScore >= rounds.r1 
          ? 'Your score is highly competitive. You are likely to secure a seat in the very first round of counseling.' 
          : 'In Round 1, top rankers holding multiple options usually secure seats here. Your score falls short of the initial R1 cutoff.'
      },
      r2: {
        status: userScore >= rounds.r2 ? 'Secured' : 'Waitlisted',
        title: userScore >= rounds.r2 && userScore < rounds.r1 
          ? 'High Probability Seat Allotment' 
          : userScore >= rounds.r1 ? 'Already Secured' : 'Waitlisted',
        desc: userScore >= rounds.r2 && userScore < rounds.r1
          ? 'As students migrate to AIQ or preferred government colleges, vacancies arise. Your score comfortably clears the Round 2 cutoff.'
          : userScore >= rounds.r1 ? 'You likely secured this in R1, but can upgrade here.' : 'Still short of the cutoff after the R2 drop.'
      },
      r3: {
        status: userScore >= rounds.r3 ? 'Secured' : 'Waitlisted',
        title: userScore >= rounds.r3 && userScore < rounds.r2 
          ? 'Seat Upgradation / Final Allotment' 
          : userScore >= rounds.r2 ? 'Already Secured' : 'Waitlisted',
        desc: userScore >= rounds.r3 && userScore < rounds.r2
          ? 'You clear the R3 cutoff! This happens as remaining stray vacancies from AIQ revert to the state pool.'
          : userScore >= rounds.r2 ? 'You likely secured this earlier.' : 'Borderline. Relying on stray vacancies.'
      },
      mopUp: {
        status: userScore >= rounds.mopUp ? 'Secured' : 'No Seat',
        title: userScore >= rounds.mopUp && userScore < rounds.r3 
          ? 'Risk Zone Allocation' 
          : userScore >= rounds.r3 ? 'Not Recommended / Unnecessary' : 'No Allotment',
        desc: userScore >= rounds.mopUp && userScore < rounds.r3
          ? 'You narrowly clear the final mop-up cutoff. This is highly unpredictable and risky.'
          : userScore >= rounds.r3 
            ? 'Since you likely secured a seat earlier, relying on Mop-up is an unnecessary risk.'
            : 'Score is below historical cutoffs even after all rounds.'
      }
    }
  };
}
