// LeetCode SRS Master - Content Script

console.log("LeetCode SRS Master loaded.");

/**
 * SRS Logic: Simple SM-2 Implementation
 * This will be used to calculate the next interval.
 */
function calculateNextReview(interval = 0, repetition = 0, easeFactor = 2.5) {
  let nextInterval;
  if (repetition === 0) {
    nextInterval = 1;
  } else if (repetition === 1) {
    nextInterval = 6;
  } else {
    nextInterval = Math.round(interval * easeFactor);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);
  
  return {
    nextInterval,
    nextRepetition: repetition + 1,
    nextEaseFactor: easeFactor,
    nextReviewDate: nextDate.toISOString()
  };
}

async function saveSubmission(problemTitle, problemSlug, difficulty) {
  const result = await chrome.storage.local.get({ problems: {} });
  const problems = result.problems;

  // Check if already exists to avoid duplicate logs for same solving session
  const today = new Date().toISOString().split('T')[0];
  const problemKey = problemSlug;

  if (problems[problemKey] && problems[problemKey].lastSolved === today) {
    console.log("Already logged this problem today.");
    return;
  }

  const currentProblem = problems[problemKey] || {
    title: problemTitle,
    slug: problemSlug,
    difficulty: difficulty,
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    history: []
  };

  const nextStep = calculateNextReview(currentProblem.interval, currentProblem.repetition, currentProblem.easeFactor);

  problems[problemKey] = {
    ...currentProblem,
    lastSolved: today,
    interval: nextStep.nextInterval,
    repetition: nextStep.nextRepetition,
    easeFactor: nextStep.nextEaseFactor,
    nextReviewDate: nextStep.nextReviewDate,
    history: [...currentProblem.history, { date: today, status: 'Accepted' }]
  };

  await chrome.storage.local.set({ problems });
  console.log("✅ Problem scheduled for SRS:", problemTitle, "Next review:", nextStep.nextReviewDate);
  
  showCompletionToast(problemTitle, nextStep.nextReviewDate);
}

function showCompletionToast(title, nextDate) {
  const dateStr = new Date(nextDate).toLocaleDateString();
  const toast = document.createElement('div');
  toast.className = 'lc-srs-toast';
  toast.innerHTML = `
    <div class="lc-srs-toast-content">
      <strong>✅ ${title} Logged!</strong>
      <span>Next review: ${dateStr}</span>
    </div>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }, 100);
}

// Observer to detect "Accepted" status
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // Look for the "Accepted" text in the submission result panel
      // LeetCode uses dynamic classes, but often has data-test attributes or specific text
      const acceptedNode = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent === 'Accepted' && 
        (el.classList.contains('text-success') || el.classList.contains('text-green-s'))
      );

      if (acceptedNode) {
        handleAcceptedSubmission();
        break;
      }
    }
  }
});

function handleAcceptedSubmission() {
  // Extract info from URL or page
  const pathParts = window.location.pathname.split('/');
  const problemSlug = pathParts[2]; // /problems/problem-slug/
  
  // Try to find title
  const titleEl = document.querySelector('span.text-lg.font-medium, div.mr-2.text-lg.font-medium');
  const title = titleEl ? titleEl.innerText : problemSlug.replace(/-/g, ' ');

  // Try to find difficulty
  const diffEl = document.querySelector('div[class*="text-difficulty-"], div[class*="text-yellow"], div[class*="text-green"], div[class*="text-red"]');
  const difficulty = diffEl ? diffEl.innerText : 'Unknown';

  saveSubmission(title, problemSlug, difficulty);
}

// Start observing the body for changes
observer.observe(document.body, { childList: true, subtree: true });
