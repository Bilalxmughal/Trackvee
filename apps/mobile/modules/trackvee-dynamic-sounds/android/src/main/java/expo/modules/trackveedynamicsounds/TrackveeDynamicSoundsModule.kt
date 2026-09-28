package expo.modules.trackveedynamicsounds

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class TrackveeDynamicSoundsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TrackveeDynamicSounds")

    AsyncFunction("installSound") { soundId: String, fileName: String, soundName: String, sourceUri: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@AsyncFunction false
      if (!soundId.matches(Regex("^[0-9a-fA-F-]{36}$")) || !fileName.matches(Regex("^tv_[0-9a-f]{32}\\.wav$"))) {
        return@AsyncFunction false
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      val source = Uri.parse(sourceUri)
      val soundUri = findOrCreateNotificationSound(context, source, fileName) ?: return@AsyncFunction false
      val compactId = soundId.replace("-", "").lowercase()
      val channelId = "trackvee-alerts-dyn-$compactId"
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(channelId) == null) {
        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        val channel = NotificationChannel(channelId, "Trackvee alerts · $soundName", NotificationManager.IMPORTANCE_HIGH)
        channel.enableVibration(true)
        channel.vibrationPattern = longArrayOf(0, 250, 250, 250)
        channel.setSound(soundUri, attributes)
        manager.createNotificationChannel(channel)
      }
      true
    }
  }

  private fun findOrCreateNotificationSound(context: Context, source: Uri, fileName: String): Uri? {
    val resolver = context.contentResolver
    val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val relativePath = "${Environment.DIRECTORY_NOTIFICATIONS}/Trackvee/"
    val projection = arrayOf(MediaStore.Audio.Media._ID)
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?"
    resolver.query(collection, projection, selection, arrayOf(fileName, relativePath), null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        return ContentUris.withAppendedId(collection, cursor.getLong(0))
      }
    }

    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
      put(MediaStore.MediaColumns.MIME_TYPE, "audio/wav")
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val destination = resolver.insert(collection, values) ?: return null
    try {
      val input = if (source.scheme == "file") File(source.path ?: throw IllegalArgumentException("Missing sound path")).inputStream() else resolver.openInputStream(source)
        ?: throw IllegalStateException("Could not read downloaded sound")
      input.use { stream ->
        val output = resolver.openOutputStream(destination, "w")
          ?: throw IllegalStateException("Could not write notification sound")
        output.use { stream.copyTo(it) }
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        resolver.update(destination, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      }
      return destination
    } catch (_: Exception) {
      resolver.delete(destination, null, null)
      return null
    }
  }
}
