import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://*.twitter.com/*", "https://*.x.com/*"]
}

// Create and inject the sidebar
function injectSidebar() {
  // Only inject on twitter.com or x.com domains
  const hostname = window.location.hostname
  if (!hostname.includes("twitter.com") && !hostname.includes("x.com")) {
    return
  }

  // Create sidebar element
  const sidebar = document.createElement("div")
  sidebar.id = "twooter-sidebar"
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100vh;
    background-color: #ffffff;
    box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: transform 0.3s ease;
    transform: translateX(300px);
  `

  // Add content to sidebar
  const content = document.createElement("h1")
  content.textContent = "Twoot"
  content.style.cssText = `
    color: #1DA1F2;
    font-size: 24px;
    font-weight: bold;
  `

  // Create toggle button
  const toggleButton = document.createElement("button")
  toggleButton.style.cssText = `
    position: absolute;
    left: -30px;
    top: 20px;
    width: 30px;
    height: 30px;
    background-color: #ffffff;
    border: none;
    border-radius: 4px 0 0 4px;
    box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
  `

  // Create arrow icon
  const arrow = document.createElement("div")
  arrow.style.cssText = `
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 8px solid #1DA1F2;
    transition: transform 0.3s ease;
    transform: rotate(0deg);
  `
  toggleButton.appendChild(arrow)

  // Add click handler for toggle
  let isCollapsed = true
  toggleButton.addEventListener("click", () => {
    isCollapsed = !isCollapsed
    sidebar.style.transform = isCollapsed
      ? "translateX(300px)"
      : "translateX(0)"
    arrow.style.transform = isCollapsed ? "rotate(0deg)" : "rotate(180deg)"
  })

  sidebar.appendChild(content)
  sidebar.appendChild(toggleButton)
  document.body.appendChild(sidebar)
}

// Run when the content script loads
injectSidebar()
