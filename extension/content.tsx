import type { PlasmoCSConfig } from "plasmo"
import * as React from "react"
import { useCallback, useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["https://*.twitter.com/*", "https://*.x.com/*"]
}

const API_ENDPOINT = "https://twooter.ibm456.workers.dev"

interface TweetInfo {
  text: string
  element: HTMLElement
  index: number
  metadata: {
    author: string
    username: string
    timestamp: string
    retweets: string
    likes: string
  }
}

const extractTweetMetadata = (article: HTMLElement) => {
  const metadata = {
    author: "",
    username: "",
    timestamp: "",
    retweets: "",
    likes: ""
  }

  // Get author info from the article
  const authorElement = article.querySelector('div[data-testid="User-Name"]')
  if (authorElement) {
    const spans = authorElement.querySelectorAll("span")
    if (spans.length >= 2) {
      metadata.author = spans[0]?.textContent?.trim() || ""
      metadata.username = spans[1]?.textContent?.trim() || ""
    }
  }

  // Get timestamp
  const timeElement = article.querySelector("time")
  metadata.timestamp = timeElement?.getAttribute("datetime") || ""

  // Get engagement stats
  const statsContainer = article.querySelector('div[role="group"]')
  if (statsContainer) {
    const stats = statsContainer.querySelectorAll("div[data-testid]")
    stats.forEach((stat) => {
      const testId = stat.getAttribute("data-testid")
      const value = stat.textContent?.trim() || ""
      if (testId?.includes("retweet")) {
        metadata.retweets = value
      } else if (testId?.includes("like")) {
        metadata.likes = value
      }
    })
  }

  return metadata
}

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [filters, setFilters] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newFilter, setNewFilter] = useState("")
  const [tweets, setTweets] = useState<TweetInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const extractTweets = useCallback(() => {
    const tweetTexts = document.querySelectorAll("div[lang]")
    const newTweets: TweetInfo[] = []

    tweetTexts.forEach((element, index) => {
      if (element.textContent && element.textContent.trim()) {
        const articleParent = element.closest("article")
        if (articleParent) {
          newTweets.push({
            text: element.textContent.trim(),
            element: articleParent as HTMLElement,
            index,
            metadata: extractTweetMetadata(articleParent as HTMLElement)
          })
        }
      }
    })

    setTweets(newTweets)
    return newTweets
  }, [])

  const applyFilters = useCallback(
    async (currentTweets: TweetInfo[], currentFilters: string[]) => {
      if (currentFilters.length === 0) {
        // If no filters, show all tweets
        currentTweets.forEach((tweet) => {
          tweet.element.style.display = "block"
        })
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tweets: currentTweets.map((t) => ({
              text: t.text,
              metadata: t.metadata
            })),
            filters: currentFilters
          })
        })

        if (!response.ok) {
          throw new Error("API request failed")
        }

        const { passedIndices } = await response.json()

        // Hide all tweets first
        currentTweets.forEach((tweet) => {
          tweet.element.style.display = "none"
        })

        // Show only tweets that passed all filters
        passedIndices.forEach((index) => {
          const tweet = currentTweets.find((t) => t.index === index)
          if (tweet) {
            tweet.element.style.display = "block"
          }
        })
      } catch (error) {
        console.error("Error applying filters:", error)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    // Initial tweet extraction
    const initialTweets = extractTweets()

    // Set up observer for new tweets
    const observer = new MutationObserver(() => {
      const newTweets = extractTweets()
      applyFilters(newTweets, filters)
    })

    const mainContent = document.querySelector("main")
    if (mainContent) {
      observer.observe(mainContent, {
        childList: true,
        subtree: true
      })
    }

    return () => observer.disconnect()
  }, [extractTweets, applyFilters, filters])

  // Apply filters whenever they change
  useEffect(() => {
    applyFilters(tweets, filters)
  }, [tweets, filters, applyFilters])

  const handleSave = () => {
    if (newFilter.trim()) {
      const updatedFilters = [...filters, newFilter.trim()]
      setFilters(updatedFilters)
      setNewFilter("")
      applyFilters(tweets, updatedFilters)
    }
    setIsAdding(false)
  }

  const handleDelete = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index)
    setFilters(updatedFilters)
    applyFilters(tweets, updatedFilters)
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "300px",
        height: "100vh",
        backgroundColor: "#000000",
        boxShadow:
          "-2px 0 5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        transition: "transform 0.3s ease",
        transform: isCollapsed ? "translateX(300px)" : "translateX(0)",
        color: "#ffffff"
      }}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: "absolute",
          left: "-30px",
          top: "20px",
          width: "30px",
          height: "30px",
          backgroundColor: "#000000",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "4px 0 0 4px",
          boxShadow:
            "-2px 0 5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1)",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 0
        }}>
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: "8px solid #ffffff",
            filter: "drop-shadow(0 0 1px rgba(0, 0, 0, 0.5))",
            transition: "transform 0.3s ease",
            transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)"
          }}
        />
      </button>

      <h1
        style={{
          color: "#ffffff",
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "20px"
        }}>
        Filters {isLoading && "(Applying...)"}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filters.map((filter, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px",
              backgroundColor: "#1a1a1a",
              borderRadius: "4px",
              color: "#ffffff"
            }}>
            <span style={{ flex: 1 }}>{filter}</span>
            <button
              onClick={() => handleDelete(index)}
              style={{
                padding: "4px 8px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}>
              Delete
            </button>
          </div>
        ))}

        {isAdding ? (
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={newFilter}
              onChange={(e) => setNewFilter(e.target.value)}
              placeholder="Enter filter text"
              style={{
                flex: 1,
                padding: "8px",
                border: "1px solid #333333",
                borderRadius: "4px",
                backgroundColor: "#1a1a1a",
                color: "#ffffff"
              }}
            />
            <button
              onClick={handleSave}
              disabled={isLoading}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1
              }}>
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            disabled={isLoading}
            style={{
              padding: "8px",
              backgroundColor: "#1DA1F2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              width: "fit-content",
              opacity: isLoading ? 0.7 : 1
            }}>
            +
          </button>
        )}
      </div>
    </div>
  )
}

export default Sidebar
