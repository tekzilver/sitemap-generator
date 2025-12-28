document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const urlInput = document.getElementById('urlInput');
  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');

  function resetUI() {
    generateBtn.disabled = false;
    statusDiv.textContent = 'Ready to start.';
    statusDiv.style.color = '#666';
    progressContainer.style.display = 'none';
    progressBar.value = 0;
    progressText.textContent = '0%';
  }

  // 1. LISTENER: Handle messages from Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PROGRESS_UPDATE') {
      progressContainer.style.display = 'block';
      const percent = Math.floor((message.visited / message.max) * 100);
      progressBar.value = percent;
      progressText.textContent = `${percent}% (${message.visited} URLs found)`;
      statusDiv.textContent = 'Crawling... please wait.';
      statusDiv.style.color = '#333';
    }

    if (message.action === 'CRAWL_COMPLETE') {
      resetUI();
      
      if (message.success) {
        statusDiv.textContent = `Success! Found ${message.count} URLs.`;
        statusDiv.style.color = 'green';
        downloadXml(message.xml, message.baseUrl);
      } else {
        statusDiv.textContent = `Error: ${message.message}`;
        statusDiv.style.color = 'red';
      }
    }
  });

  // Auto-fill current tab URL, but handle chrome://newtab/ gracefully
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      // If the user is on a new tab or internal page, use the example
      if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('edge://')) {
        urlInput.value = "https://example.com";
      } else {
        urlInput.value = tabs[0].url;
      }
    }
  });

  generateBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();

    if (!isValidUrl(url)) {
      resetUI();
      statusDiv.textContent = 'Error: Please use a valid URL starting with http:// or https://';
      statusDiv.style.color = 'red';
      return;
    }

    startCrawl(url);
  });

  function startCrawl(url) {
    generateBtn.disabled = true;
    // Updated status text as requested
    statusDiv.textContent = 'Starting crawl... please wait.';
    statusDiv.style.color = '#333';
    
    progressContainer.style.display = 'block';
    progressBar.value = 0;
    progressText.textContent = '0%';

    chrome.runtime.sendMessage({ action: 'START_CRAWL', url: url }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        resetUI();
        statusDiv.textContent = 'Error: Could not communicate with background script.';
        statusDiv.style.color = 'red';
      }
    });
  }

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function downloadXml(xmlString, baseUrl) {
    const domain = new URL(baseUrl).hostname;
    const blob = new Blob([xmlString], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    
    // Use chrome.downloads API to ask user where to save (Save As dialog)
    chrome.downloads.download({
      url: url,
      filename: `sitemap-${domain}.xml`,
      saveAs: true // This forces the "Save As" prompt
    }, (downloadId) => {
      // Cleanup
      URL.revokeObjectURL(url);
    });
  }
});