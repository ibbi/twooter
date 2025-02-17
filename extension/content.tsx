import type { PlasmoCSConfig } from "plasmo"
import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

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
  const lastUpdateRef = useRef<number>(0)
  const processingRef = useRef<boolean>(false)

  const extractTweets = useCallback(() => {
    // Prevent rapid re-extractions
    const now = Date.now()
    if (now - lastUpdateRef.current < 500) {
      return tweets
    }
    lastUpdateRef.current = now

    // Find all tweet articles first
    const articles = document.querySelectorAll('article[data-testid="tweet"]')
    const newTweets: TweetInfo[] = []
    const seenArticles = new Set<HTMLElement>()

    articles.forEach((article, index) => {
      if (seenArticles.has(article as HTMLElement)) return

      // Find the main tweet text div
      const tweetText = article.querySelector('div[data-testid="tweetText"]')
      if (tweetText?.textContent?.trim()) {
        seenArticles.add(article as HTMLElement)
        newTweets.push({
          text: tweetText.textContent.trim(),
          element: article as HTMLElement,
          index,
          metadata: extractTweetMetadata(article as HTMLElement)
        })
      }
    })

    console.log("Extracted tweets:", newTweets.length) // Debug log

    // Only update state if tweets have actually changed
    if (
      JSON.stringify(newTweets.map((t) => t.text)) !==
      JSON.stringify(tweets.map((t) => t.text))
    ) {
      setTweets(newTweets)
      return newTweets
    }
    return tweets
  }, [tweets])

  const applyFilters = useCallback(
    async (currentTweets: TweetInfo[], currentFilters: string[]) => {
      if (processingRef.current) return
      if (currentTweets.length === 0) return // Don't process if no tweets
      processingRef.current = true

      if (currentFilters.length === 0) {
        currentTweets.forEach((tweet) => {
          if (tweet.element.style.display !== "block") {
            tweet.element.style.display = "block"
          }
        })
        processingRef.current = false
        return
      }

      setIsLoading(true)
      try {
        console.log("Sending tweets to API:", currentTweets.length) // Debug log
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
        console.log("Received passed indices:", passedIndices) // Debug log

        // Update display states only if they need to change
        currentTweets.forEach((tweet) => {
          const shouldShow = passedIndices.includes(tweet.index)
          const isCurrentlyShown = tweet.element.style.display === "block"

          if (shouldShow !== isCurrentlyShown) {
            tweet.element.style.display = shouldShow ? "block" : "none"
          }
        })
      } catch (error) {
        console.error("Error applying filters:", error)
      } finally {
        setIsLoading(false)
        processingRef.current = false
      }
    },
    []
  )

  useEffect(() => {
    // Wait for Twitter to load its content
    const timeout = setTimeout(() => {
      const initialTweets = extractTweets()
      if (initialTweets.length > 0) {
        applyFilters(initialTweets, filters)
      }
    }, 2000)

    // Debounced observer callback
    let timeoutId: NodeJS.Timeout
    const debouncedExtract = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (!processingRef.current) {
          const newTweets = extractTweets()
          if (newTweets !== tweets && newTweets.length > 0) {
            applyFilters(newTweets, filters)
          }
        }
      }, 500)
    }

    // Set up observer for new tweets
    const observer = new MutationObserver((mutations) => {
      // Only process if mutations affect the tweet content
      const hasRelevantChanges = mutations.some(
        (mutation) =>
          mutation.target.nodeType === Node.ELEMENT_NODE &&
          (mutation.target as Element).closest('article[data-testid="tweet"]')
      )

      if (hasRelevantChanges) {
        debouncedExtract()
      }
    })

    const mainContent = document.querySelector("main")
    if (mainContent) {
      observer.observe(mainContent, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      })
    }

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
      clearTimeout(timeout)
    }
  }, [extractTweets, applyFilters, filters, tweets])

  // Apply filters whenever they change
  useEffect(() => {
    if (!processingRef.current) {
      applyFilters(tweets, filters)
    }
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
