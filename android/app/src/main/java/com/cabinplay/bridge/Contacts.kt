package com.cabinplay.bridge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject

/**
 * The phone's address book, read through `ContactsContract` when the player has granted contact access.
 * Only the name and numbers travel: photos (which can be hundreds of kilobytes each) come in a later phase.
 */
object Contacts {
    /** Keep a whole address book under the host's message size; the newest phones still fit inside this. */
    private const val MOST = 2000

    fun allowed(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    /** The phone's contacts, one entry per contact with all of its numbers, or an empty array without access. */
    fun snapshot(context: Context): JSONArray {
        if (!allowed(context)) return JSONArray()
        val contacts = LinkedHashMap<String, Entry>()
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        )
        runCatching {
            context.contentResolver
                .query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, null)
                ?.use { cursor ->
                    val idAt = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameAt =
                        cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY)
                    val numberAt = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    while (cursor.moveToNext() && contacts.size < MOST) {
                        val id = cursor.getString(idAt) ?: continue
                        val name = cursor.getString(nameAt)?.trim().orEmpty().ifBlank { cursor.getString(numberAt) ?: "" }
                        if (name.isBlank()) continue
                        val number = cursor.getString(numberAt)?.trim().orEmpty()
                        val entry = contacts.getOrPut(id) { Entry(id, name) }
                        if (number.isNotBlank()) entry.numbers.add(number)
                    }
                }
        }
        return JSONArray().apply {
            contacts.values.forEach { contact ->
                if (contact.numbers.isEmpty()) return@forEach
                put(
                    JSONObject()
                        .put("id", contact.id)
                        .put("name", contact.name)
                        .put("numbers", JSONArray(contact.numbers.toList())),
                )
            }
        }
    }

    private class Entry(val id: String, val name: String) {
        val numbers = LinkedHashSet<String>()
    }
}
