-- Allow original video and audio containers. Preserve old mp4/hls rows.
ALTER TABLE media_assets MODIFY COLUMN format ENUM('mp4','hls','mkv','mka','m4v','webm','mov','avi','flv','ts','m2ts','mpg','mpeg','mp3','m4a','aac','flac','wav','ogg','ogv','opus','3gp') NOT NULL;
