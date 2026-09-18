package com.schedule.model;

import com.schedule.engine.SolveResult;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;

/**
 * Deterministic snapshot of a solved store schedule.
 * Consumers can compare revisionId / scheduleHash instead of browser localStorage.
 */
public final class ScheduleRevision {

    private final String storeId;
    private final String revisionId;
    private final Instant generatedAt;
    private final String source;
    private final String sourceRevision;
    private final String scheduleHash;
    private final SolveResult result;

    public ScheduleRevision(
            String storeId,
            Instant generatedAt,
            String source,
            String sourceRevision,
            SolveResult result
    ) {
        this.storeId = Objects.requireNonNull(storeId, "storeId");
        this.generatedAt = generatedAt == null ? Instant.now() : generatedAt;
        this.source = source == null ? "manual" : source;
        this.sourceRevision = sourceRevision == null ? "" : sourceRevision;
        this.result = Objects.requireNonNull(result, "result");
        this.scheduleHash = computeHash(storeId, this.generatedAt, this.source,
                this.sourceRevision, result);
        this.revisionId = scheduleHash.length() >= 8
                ? scheduleHash.substring(0, 8)
                : scheduleHash;
    }

    public String getStoreId() {
        return storeId;
    }

    public String getRevisionId() {
        return revisionId;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public String getSource() {
        return source;
    }

    public String getSourceRevision() {
        return sourceRevision;
    }

    public String getScheduleHash() {
        return scheduleHash;
    }

    public SolveResult getResult() {
        return result;
    }

    private static String computeHash(
            String storeId,
            Instant generatedAt,
            String source,
            String sourceRevision,
            SolveResult result
    ) {
        String payload = storeId + "|" + generatedAt + "|" + source + "|" + sourceRevision
                + "|a=" + result.assignmentCount()
                + "|g=" + result.gapCount()
                + "|w=" + result.getWarnings().size()
                + "|c=" + result.isFullyCovered();
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(payload.hashCode());
        }
    }
}
