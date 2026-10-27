import os
import json
import base64
import numpy as np
import cv2
import face_recognition

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
FACES_DIR = os.path.join(UPLOADS_DIR, "faces")
SNAPSHOTS_DIR = os.path.join(UPLOADS_DIR, "snapshots")

os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# Default tolerance for face matching
FACE_MATCH_TOLERANCE = 0.52

def decode_base64_image(image_base64: str) -> np.ndarray:
    """Decodes a base64 string (with or without data URI header) into an RGB OpenCV image."""
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_base64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Failed to decode image from buffer")
        # Convert BGR to RGB for face_recognition
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        return img_rgb
    except Exception as e:
        raise ValueError(f"Invalid image data: {str(e)}")

def extract_face_encoding(rgb_image: np.ndarray):
    """
    Finds face locations and extracts a 128-dimensional embedding from the primary face in rgb_image.
    Returns: (encoding_list, box_dict, error_msg)
    """
    # Downscale slightly if image is too large for faster processing
    h, w = rgb_image.shape[:2]
    scale = 1.0
    processed_image = rgb_image
    if max(h, w) > 1200:
        scale = 1200.0 / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        processed_image = cv2.resize(rgb_image, (new_w, new_h))

    # Detect faces
    face_locations = face_recognition.face_locations(processed_image, model="hog")
    if not face_locations:
        return None, None, "No face detected in the frame. Please look directly at the webcam with good lighting."
    
    # If multiple faces detected, pick the largest one
    if len(face_locations) > 1:
        # Choose the face with the largest area
        face_locations.sort(key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]), reverse=True)

    primary_loc = face_locations[0]
    encodings = face_recognition.face_encodings(processed_image, known_face_locations=[primary_loc])
    if not encodings:
        return None, None, "Could not extract clear biometric features from the face. Please reposition and retry."

    encoding_128 = encodings[0].tolist()

    # Rescale box back to original coordinates if image was scaled
    top, right, bottom, left = primary_loc
    if scale != 1.0:
        top = int(top / scale)
        right = int(right / scale)
        bottom = int(bottom / scale)
        left = int(left / scale)

    box = {"top": top, "right": right, "bottom": bottom, "left": left}
    return encoding_128, box, None

def match_face_in_frame(rgb_image: np.ndarray, registered_employees: list):
    """
    Detects all faces in rgb_image and compares them against registered employees.
    registered_employees: list of dicts with keys:
       'id', 'employee_code', 'first_name', 'last_name', 'department', 'designation', 'photo_url', 'encoding_np'
    Returns list of matches.
    """
    # For speed in live video stream, resize frame to 1/2 or 1/3
    h, w = rgb_image.shape[:2]
    scale = 0.5
    small_rgb = cv2.resize(rgb_image, (0, 0), fx=scale, fy=scale)

    face_locations = face_recognition.face_locations(small_rgb, model="hog")
    if not face_locations:
        return [], 0

    face_encodings = face_recognition.face_encodings(small_rgb, face_locations)
    matches = []

    # Prepare known encodings
    known_encodings = [emp['encoding_np'] for emp in registered_employees if emp['encoding_np'] is not None]
    known_employees = [emp for emp in registered_employees if emp['encoding_np'] is not None]

    for (top, right, bottom, left), current_encoding in zip(face_locations, face_encodings):
        # Scale back coordinates to original frame size
        orig_top = int(top / scale)
        orig_right = int(right / scale)
        orig_bottom = int(bottom / scale)
        orig_left = int(left / scale)
        box = {"top": orig_top, "right": orig_right, "bottom": orig_bottom, "left": orig_left}

        best_match = None
        best_distance = 1.0

        if known_encodings:
            distances = face_recognition.face_distance(known_encodings, current_encoding)
            min_idx = int(np.argmin(distances))
            best_distance = float(distances[min_idx])

            if best_distance <= FACE_MATCH_TOLERANCE:
                emp = known_employees[min_idx]
                # Calculate confidence percentage (e.g. distance 0.35 -> confidence 88%)
                confidence = round(max(0.0, min(100.0, (1.0 - (best_distance / FACE_MATCH_TOLERANCE)) * 40.0 + 60.0)), 1)
                full_name = emp.get("name") or f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                best_match = {
                    "employee_id": emp["id"],
                    "employee_code": emp.get("employee_id") or emp.get("employee_code"),
                    "full_name": full_name,
                    "department": emp["department"],
                    "designation": emp["designation"],
                    "photo_url": emp.get("photo_url"),
                    "confidence": confidence,
                    "distance": round(best_distance, 4),
                    "box": box
                }

        if best_match:
            matches.append(best_match)
        else:
            # Face detected but unknown/unrecognized
            matches.append({
                "employee_id": 0,
                "employee_code": "UNKNOWN",
                "full_name": "Unregistered Visitor",
                "department": "Unknown",
                "designation": "Visitor",
                "photo_url": None,
                "confidence": 0.0,
                "distance": round(best_distance, 4),
                "box": box
            })

    return matches, len(face_locations)

def save_snapshot_image(image_base64: str, prefix: str = "snap") -> str:
    """Saves a base64 snapshot to disk and returns the relative URL path."""
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_base64)
        filename = f"{prefix}_{os.urandom(6).hex()}.jpg"
        filepath = os.path.join(SNAPSHOTS_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return f"/uploads/snapshots/{filename}"
    except Exception as e:
        print(f"Error saving snapshot: {e}")
        return ""

def save_face_profile_image(image_base64: str, employee_id: int) -> str:
    """Saves an employee's registered face photo to disk and returns the relative URL path."""
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_base64)
        filename = f"emp_{employee_id}_{os.urandom(4).hex()}.jpg"
        filepath = os.path.join(FACES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return f"/uploads/faces/{filename}"
    except Exception as e:
        print(f"Error saving face profile image: {e}")
        return ""
