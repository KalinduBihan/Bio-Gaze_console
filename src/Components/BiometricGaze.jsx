import React, { useState, useRef, useEffect } from "react";
import { database, ref, onValue, push } from "../firebase";

function BiometricGaze() {
  const [data, setData] = useState({ bpm: 0, temperature: 0 });
  const [candidateId, setCandidateId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [records, setRecords] = useState([]);
  const [response, setResponse] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [focusIndex, setFocusIndex] = useState(null);

  const API_URL = "https://web-production-8c6d.up.railway.app/predict";

  useEffect(() => {
    const sensorRef = ref(database, "sensorData");
    onValue(sensorRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.val());
      }
    });
  }, []);

  const handleStart = async () => {
    if (!candidateId.trim()) {
      alert("Please enter a Candidate ID / Video Name!");
      return;
    }

    // Start Biometric Recording
    setIsRecording(true);
    setRecords([]);
    setResponse(null);

    // Start Video Recording
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    // camera preview
    videoRef.current.srcObject = stream;

    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setVideoBlob(blob);

      setTimeout(() => {
        uploadVideo(blob);
      }, 3000);
    };

    mediaRecorderRef.current.start();
  };

  const handleStop = async () => {
    setIsRecording(false);
    mediaRecorderRef.current.stop(); // Stop Video Recording

    const payload = {
      id: candidateId,
      data: records,
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      setResponse(result);

      // Store results in Firebase
      const dbRef = ref(database, `BiometricGaze/${candidateId}`);
      push(dbRef, {
        timestamp: new Date().toISOString(),
        result: result,
        records: records,
      });
    } catch (error) {
      console.error("Error sending data:", error);
      setResponse({ error: "Failed to send data" });
    }
  };

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        const newRecord = {
          HR: data.bpm,
          TEMP: data.temperature,
          datetime: new Date().toISOString().replace("T", " ").split(".")[0],
        };
        setRecords((prevRecords) => [...prevRecords, newRecord]);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRecording, data]);

  const uploadVideo = async (videoBlob) => {
    if (!videoBlob) {
      alert("No video recorded.");
      return;
    }

    const videoFilename = `${candidateId}.webm`;
    const formData = new FormData();
    formData.append("file", videoBlob, videoFilename);

    try {
      const response = await fetch("http://34.16.104.84:5000/upload", {
        // const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed.");
      }

      const data = await response.json();
      console.log(data.message);

      // Call /eyeCoordinates after successful upload
      fetchEyeCoordinates(videoFilename);
    } catch (error) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
    }
  };

  const fetchEyeCoordinates = async (videoFilename) => {
    try {
      // const response = await fetch("http://localhost:5000/eyeCoordinates", {
      const response = await fetch("http://34.16.104.84:5000/eyeCoordinates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_path: `gs://eye-tracker-videos-12345/${videoFilename.replace(
            ".webm",
            "_cropped.mp4"
          )}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch eye coordinates.");
      }

      const data = await response.json();
      setFocusIndex(data.focus_index); // Store focus index

      console.log("Focus Index:", data.focus_index);

      // Store in Firebase
      const dbRef = ref(database, `BiometricGaze/${candidateId}/eyeTracking`);
      push(dbRef, {
        timestamp: new Date().toISOString(),
        focus_index: data.focus_index,
        eye_coordinates: data.eye_coordinates, // Save entire eye tracking data
      });

      alert(`Focus Index: ${data.focus_index}%`);
    } catch (error) {
      console.error("Error fetching eye coordinates:", error);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold">BiometricGaze</h1>

      <input
        type="text"
        placeholder="Enter Candidate ID / Video Name"
        value={candidateId}
        onChange={(e) => setCandidateId(e.target.value)}
        className="mt-4 p-2 border rounded"
        disabled={isRecording} // Prevent name change while recording
      />

      {/* embeded camera preview */}
      <video ref={videoRef} width="600" height="400" autoPlay></video>

      <div className="mt-6 p-6 bg-white shadow-lg rounded-lg text-center">
        <p className="text-xl">❤️ Heart Rate: {data.bpm} BPM</p>
        <p className="text-xl">🌡️ Temperature: {data.temperature}°C</p>
      </div>

      <div className="mt-4">
        {!isRecording ? (
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-green-500 text-white rounded m-2"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-500 text-white rounded m-2"
            disabled={records.length === 0}
          >
            Stop Recording
          </button>
        )}
      </div>

      {response && (
        <div className="mt-6 p-4 bg-blue-200 w-3/4 text-sm">
          <h2 className="font-bold">Server Response:</h2>
          <pre className="text-left">{JSON.stringify(response, null, 2)}</pre>
          {focusIndex !== null && (
            <div className="mt-6 p-4 bg-green-200 w-3/4 text-sm">
              <h3 className="font-bold mt-2">Focus Index: {focusIndex} %</h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BiometricGaze;
