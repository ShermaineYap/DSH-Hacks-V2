#!/bin/bash
# usage: compose.sh <scene...>  (renders scenes/<k>.mp4 with matching audio)
set -e
W=/tmp/claude-0/-home-claude/90b8c705-da9e-5994-a3c3-301977ec2164/scratchpad/video
V=/tmp/claude-0/-home-claude/90b8c705-da9e-5994-a3c3-301977ec2164/scratchpad/voice/out
cd $W; mkdir -p scenes
declare -A PHONE=( [s3]=days [s4]=message [s5]=slip [s6]=verdict [s7]=record )
ENC="-c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p -r 30"
BG=0xf5f7fb
for k in "$@"; do
  nd=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V/$k.wav)
  D=$(python3 -c "print(round($nd+1.1,2))")
  FO=$(python3 -c "print(round($D-0.35,2))")
  if [ -n "${PHONE[$k]}" ]; then
    ffmpeg -y -v error -framerate 30 -i $k.png -f concat -safe 0 -i frames/${PHONE[$k]}/list.txt \
      -filter_complex "[0]format=yuv420p,loop=-1:1[bg];[1]fps=30,scale=458:988,setsar=1,tpad=stop_mode=clone:stop_duration=30[ph];[bg][ph]overlay=250:46:shortest=0,trim=duration=$D,fade=in:st=0:d=0.35:color=$BG,fade=out:st=$FO:d=0.35:color=$BG[v]" \
      -map "[v]" $ENC -t $D scenes/tmp_$k.mp4
  else
    ffmpeg -y -v error -framerate 30 -i $k.png -vf "format=yuv420p,loop=-1:1,trim=duration=$D,fade=in:st=0:d=0.35:color=$BG,fade=out:st=$FO:d=0.35:color=$BG" $ENC -t $D scenes/tmp_$k.mp4
  fi
  ffmpeg -y -v error -i $V/$k.wav -af "adelay=450|450,apad,atrim=0:$D,aresample=48000" -ac 2 -c:a pcm_s16le scenes/tmp_$k.wav
  mv scenes/tmp_$k.mp4 scenes/$k.mp4; mv scenes/tmp_$k.wav scenes/$k.wav
  echo "$k $D s"
done
