package com.cabinplay.bridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The code check the phone makes before it knocks on the PC's door, kept to the same rule the PC reads a saved
 * token back with (`token_from` in crates/link): 8–128 characters of base64url, no padding. The PC writes sixteen
 * of them from twelve random bytes.
 */
class PairingTest {
    @Test
    fun acceptsTheCodeCabinPlayWrites() {
        assertTrue(Pairing.isValidToken("Zk3l0Qx9Tf2aB7mn"))
        // A token of a different length the PC would still read back, so the phone must not be stricter than it.
        assertTrue(Pairing.isValidToken("abcd1234"))
        assertTrue(Pairing.isValidToken("a".repeat(128)))
        assertTrue(Pairing.isValidToken("a-_9".repeat(4)))
    }

    @Test
    fun rejectsTheWrongLengths() {
        assertFalse(Pairing.isValidToken(""))
        assertFalse(Pairing.isValidToken("abcd123"))
        assertFalse(Pairing.isValidToken("a".repeat(129)))
    }

    @Test
    fun rejectsWhatAPasteBrings() {
        // A pasted line break, a space the player typed, or base64 padding from another tool's copy: all of these
        // reach the socket if unchecked and come back as the PC closing the link, which blames the wrong thing.
        assertFalse(Pairing.isValidToken("Zk3l Qx9Tf2aB7mn"))
        assertFalse(Pairing.isValidToken(" Zk3l0Qx9Tf2aB7m"))
        assertFalse(Pairing.isValidToken("Zk3l0Qx9Tf2aB7mn\n"))
        assertFalse(Pairing.isValidToken("Zk3l0Qx9Tf2aB7m="))
    }

    @Test
    fun rejectsCharactersNoCodeContains() {
        // Standard base64's + and /, and letters and digits outside ASCII: the PC writes neither, and its reader
        // refuses them too, so a code holding one was mistyped or copied from somewhere else.
        assertFalse(Pairing.isValidToken("Zk3l+Qx9Tf2aB7mn"))
        assertFalse(Pairing.isValidToken("Zk3l/Qx9Tf2aB7mn"))
        assertFalse(Pairing.isValidToken("Äk3l0Qx9Tf2aB7mn"))
        assertFalse(Pairing.isValidToken("Zk3l0Qx9Tf2aB7m١"))
    }
}
