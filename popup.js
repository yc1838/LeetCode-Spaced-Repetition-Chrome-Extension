// LeetCode SRS Master - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    await updateDashboard();
});

async function updateDashboard() {
    const result = await chrome.storage.local.get({ problems: {} });
    const problems = Object.values(result.problems);

    const now = new Date();
    const dueProblems = problems.filter(p => new Date(p.nextReviewDate) <= now);

    document.getElementById('due-count').innerText = dueProblems.length;
    document.getElementById('total-count').innerText = problems.length;

    const listContainer = document.getElementById('problem-list');
    listContainer.innerHTML = '';

    if (dueProblems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No problems due for review today! Great job.</div>';
        return;
    }

    dueProblems.forEach(problem => {
        const card = document.createElement('div');
        card.className = 'problem-card';
        card.innerHTML = `
      <div class="problem-info">
        <span class="problem-title" title="${problem.title}">${problem.title}</span>
        <span class="difficulty-badge ${problem.difficulty}">${problem.difficulty}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-hard" data-id="${problem.slug}" data-ease="1.3">Hard</button>
        <button class="btn btn-medium" data-id="${problem.slug}" data-ease="2.5">Med</button>
        <button class="btn btn-easy" data-id="${problem.slug}" data-ease="3.5">Easy</button>
      </div>
    `;

        // Open LeetCode problem when clicking title
        card.querySelector('.problem-title').onclick = () => {
            chrome.tabs.create({ url: `https://leetcode.com/problems/${problem.slug}/` });
        };

        // Handle SRS grading
        card.querySelectorAll('.btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const slug = btn.getAttribute('data-id');
                const ease = parseFloat(btn.getAttribute('data-ease'));
                await updateProblemSRS(slug, ease);
            };
        });

        listContainer.appendChild(card);
    });
}

function calculateNextReview(interval, repetition, easeFactor) {
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

async function updateProblemSRS(slug, ease) {
    const result = await chrome.storage.local.get({ problems: {} });
    const problems = result.problems;
    const p = problems[slug];

    if (!p) return;

    const nextStep = calculateNextReview(p.interval, p.repetition, ease);

    problems[slug] = {
        ...p,
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,
        history: [...p.history, { date: new Date().toISOString(), status: 'Reviewed' }]
    };

    await chrome.storage.local.set({ problems });
    await updateDashboard();
}
