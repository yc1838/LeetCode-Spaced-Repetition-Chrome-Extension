# LeetCode LeetCode EasyRepeat

A Chrome Extension that helps you master LeetCode problems using a **Spaced Repetition System (SRS)**. It automatically tracks your "Accepted" submissions and schedules reviews based on how well you know the problem.

## 🚀 Quick Setup (Read This First!)

Before loading the extension or running tests, you **must** install the dependencies.

1.  Open your terminal in this folder.
2.  Run the following command:
    ```bash
    npm install
    ```
    > **Why?** This project uses external libraries (like `jest` for testing and `jsdom` for simulation) which are not stored in the repository to save space. `npm install` downloads them for you.

## 📥 How to Install in Chrome

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (toggle in the top-right corner).
3.  Click **Load unpacked**.
4.  Select this entire folder (`leetcode-srs-extension`).

## 🛠 Usage

- **Automatic Tracking**: Just solve a problem on LeetCode! When you see the "Accepted" text, the extension saves the result.
- **Manual Review**: Click the extension icon to see what problems are due today.
- **SRS Rating**: When reviewing from the popup, rate problems as **Easy** (push far into future), **Medium** (standard schedule), or **Hard** (review sooner).

## 🧪 Running Tests

To run the test suite (which verifies the SRS logic):
```bash
npm test
```
