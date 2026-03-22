;; quash-escrow.clar
;; Escrow contract for Quash marketplace payments
;;
;; Phase 1 - STX (live): agents call lock-stx, platform calls release-stx or refund-stx
;; Phase 2 - USDCx + sBTC (scaffolded): lock-ft / release-ft / refund-ft return
;;           ERR_NOT_YET_SUPPORTED until SIP-010 integration is complete.
;;
;; Deployer: ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE

;; --- Constants ---

(define-constant CONTRACT_OWNER tx-sender)
(define-constant PLATFORM_WALLET 'ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE)
(define-constant AUTHOR_SHARE u80)
(define-constant PLATFORM_SHARE u20)

;; Error codes
(define-constant ERR_NOT_OWNER         (err u100))
(define-constant ERR_ALREADY_EXISTS    (err u101))
(define-constant ERR_NOT_FOUND         (err u102))
(define-constant ERR_ALREADY_RELEASED  (err u103))
(define-constant ERR_ALREADY_REFUNDED  (err u104))
(define-constant ERR_NOT_YET_SUPPORTED (err u105))

;; --- Storage ---

;; Escrow map keyed by solution-id (matches Solution.id in the Quash DB)
(define-map escrows
  { solution-id: (string-ascii 64) }
  { agent:    principal,
    author:   principal,
    amount:   uint,
    currency: (string-ascii 10),
    released: bool,
    refunded: bool })

;; --- STX path - Phase 1 (live) ---

;; Called by the agent to lock payment in escrow before solution is revealed.
(define-public (lock-stx
    (solution-id (string-ascii 64))
    (author principal)
    (amount uint))
  (begin
    (asserts! (is-none (map-get? escrows { solution-id: solution-id })) ERR_ALREADY_EXISTS)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrows { solution-id: solution-id }
      { agent:    tx-sender,
        author:   author,
        amount:   amount,
        currency: "STX",
        released: false,
        refunded: false })
    (print { event: "lock-stx",
             solution-id: solution-id,
             agent: tx-sender,
             amount: amount })
    (ok true)))

;; Called by the platform (CONTRACT_OWNER) after the agent confirms the fix worked.
;; Sends 80% to the solution author, 20% to the platform treasury.
(define-public (release-stx (solution-id (string-ascii 64)))
  (let ((escrow (unwrap! (map-get? escrows { solution-id: solution-id }) ERR_NOT_FOUND)))
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
    (asserts! (not (get released escrow)) ERR_ALREADY_RELEASED)
    (asserts! (not (get refunded escrow)) ERR_ALREADY_REFUNDED)
    (let ((author-amount   (/ (* (get amount escrow) AUTHOR_SHARE)   u100))
          (platform-amount (/ (* (get amount escrow) PLATFORM_SHARE) u100)))
      (try! (as-contract (stx-transfer? author-amount   tx-sender (get author escrow))))
      (try! (as-contract (stx-transfer? platform-amount tx-sender PLATFORM_WALLET)))
      (map-set escrows { solution-id: solution-id }
        (merge escrow { released: true }))
      (print { event: "release-stx",
               solution-id: solution-id,
               author: (get author escrow),
               author-amount: author-amount,
               platform-amount: platform-amount })
      (ok true))))

;; Called by the platform if no expert claims or the solution fails.
;; Returns the full escrowed amount to the agent.
(define-public (refund-stx (solution-id (string-ascii 64)))
  (let ((escrow (unwrap! (map-get? escrows { solution-id: solution-id }) ERR_NOT_FOUND)))
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
    (asserts! (not (get released escrow)) ERR_ALREADY_RELEASED)
    (asserts! (not (get refunded escrow)) ERR_ALREADY_REFUNDED)
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get agent escrow))))
    (map-set escrows { solution-id: solution-id }
      (merge escrow { refunded: true }))
    (print { event: "refund-stx",
             solution-id: solution-id,
             agent: (get agent escrow),
             amount: (get amount escrow) })
    (ok true)))

;; --- SIP-010 path - Phase 2 (USDCx + sBTC, scaffolded) ---
;; Function signatures are final. Replace stubs with SIP-010 trait logic in Phase 2.

(define-public (lock-ft
    (solution-id (string-ascii 64))
    (author principal)
    (amount uint))
  ERR_NOT_YET_SUPPORTED)

(define-public (release-ft (solution-id (string-ascii 64)))
  ERR_NOT_YET_SUPPORTED)

(define-public (refund-ft (solution-id (string-ascii 64)))
  ERR_NOT_YET_SUPPORTED)

;; --- Read-only helpers ---

(define-read-only (get-escrow (solution-id (string-ascii 64)))
  (map-get? escrows { solution-id: solution-id }))

(define-read-only (is-released (solution-id (string-ascii 64)))
  (match (map-get? escrows { solution-id: solution-id })
    escrow (get released escrow)
    false))

(define-read-only (get-contract-owner)
  CONTRACT_OWNER)
