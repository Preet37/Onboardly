# GCP Onboarding Tasks

This document describes the GCP-specific onboarding tasks that the AI Coach can monitor and guide you through.

## Task 1: Cloud Storage Bucket Creation (`gcp_storage`)

**Goal**: Confirm the user can create storage and set public access rules safely.

### Steps

#### Step 1: Navigate to Storage → Buckets → Create
- Navigate to the GCP Console
- Go to Storage → Buckets
- Click "Create" button

**What the AI Coach watches for**:
- Keywords: "storage", "buckets", "create", "gcp", "google cloud"

---

#### Step 2: Name bucket 'onboarding-demo-bucket'
- Enter the bucket name exactly as specified
- Bucket names must be globally unique
- Use lowercase letters, numbers, hyphens

**What the AI Coach watches for**:
- Bucket name field is visible
- Name contains "onboarding-demo-bucket"

**Common mistakes the AI Coach will catch**:
- Using uppercase letters (not allowed)
- Using underscores instead of hyphens
- Missing or incorrect bucket name

**Example AI Coaching**:
```
⚠️ "I see you're trying to create a bucket, but the name field appears empty.
Bucket names must be globally unique and can only contain lowercase letters,
numbers, and hyphens. Enter 'onboarding-demo-bucket' in the name field."
```

---

#### Step 3: Select Region: us-central1
- Choose location type: Region
- Select us-central1 from the dropdown

**What the AI Coach watches for**:
- Region selection visible
- "us-central1" is selected

**Common mistakes the AI Coach will catch**:
- Selecting multi-region instead of region
- Choosing wrong region (like us-east1)

**Example AI Coaching**:
```
⚠️ "You've selected 'us-east1' but the requirement is 'us-central1'.
Using the correct region ensures your bucket is in the same location
as other GCC resources, which improves performance and reduces costs."
```

---

#### Step 4: Choose Standard storage class
- Select "Standard" as the default storage class
- Not "Nearline", "Coldline", or "Archive"

**What the AI Coach watches for**:
- Storage class selector visible
- "Standard" is selected

**Example AI Coaching**:
```
✅ "Great! You've selected Standard storage class. This is the right choice
for frequently accessed data like test files and demo content."
```

---

#### Step 5: Disable public access
- Find the "Access control" section
- Choose "Uniform" bucket-level access
- Ensure "Prevent public access" is toggled ON

**What the AI Coach watches for**:
- Public access settings visible
- "Prevent public access" or "Uniform" is enabled

**Common mistakes the AI Coach will catch**:
- Leaving public access enabled
- Using fine-grained ACLs instead of uniform access

**Example AI Coaching**:
```
⚠️ "Public access is still enabled! This is a security risk. Toggle
'Prevent public access' to ON. This ensures that objects in your bucket
cannot be accessed publicly unless you explicitly grant permissions later."
```

---

#### Step 6: Create the bucket
- Review all settings
- Click "Create" button
- Wait for the bucket to be created

**What the AI Coach watches for**:
- Create/Confirm button visible
- Success message appears

**Example AI Coaching**:
```
✅ "Perfect! Your bucket is being created with the correct settings:
- Name: onboarding-demo-bucket
- Region: us-central1
- Storage class: Standard
- Public access: Disabled

Click 'Create' to finish."
```

---

#### Step 7: Upload test file (hello.txt)
- Navigate to the newly created bucket
- Click "Upload files"
- Select or drag hello.txt
- Confirm upload

**What the AI Coach watches for**:
- Upload interface visible
- File upload in progress or complete
- "hello.txt" appears in object list

**Example AI Coaching**:
```
✅ "File uploaded successfully to onboarding-demo-bucket!
You can see 'hello.txt' in your objects list. This confirms you have
proper permissions to write to the bucket."
```

---

## Task 2: Cloud Function Deployment (`gcp_function`)

**Goal**: Test ability to deploy and verify a small serverless application.

### Steps

#### Step 1: Navigate to Cloud Functions → Create Function
- Open GCP Console
- Go to Cloud Functions
- Click "Create Function"

**What the AI Coach watches for**:
- Keywords: "cloud functions", "create function", "serverless"

---

#### Step 2: Name function 'helloGCC' (lowercase)
- Enter function name: `helloGCC`
- Function names must start with lowercase letter
- Can contain letters, numbers, hyphens, underscores

**What the AI Coach watches for**:
- Function name field visible
- Name contains "hellogcc" (case-insensitive detection)

**Common mistakes the AI Coach will catch**:
- Starting with uppercase (HelloGCC)
- Starting with a number
- Using spaces or special characters

**Example AI Coaching**:
```
⚠️ "Function name invalid - it looks like you used 'HelloGCC' which starts
with an uppercase letter. Cloud Function names must start with a lowercase
letter. Change it to 'helloGCC' (lowercase 'h')."
```

---

#### Step 3: Set trigger type to HTTP
- Select "HTTP" as the trigger type
- Note: You may need to allow unauthenticated invocations for testing

**What the AI Coach watches for**:
- Trigger type selector visible
- "HTTP" or "HTTPS" is selected

**Example AI Coaching**:
```
✅ "Good! You've selected HTTP trigger. This means your function will
be accessible via a URL, which you can test in your browser or with curl."
```

---

#### Step 4: Select runtime: Python 3.11
- Scroll to runtime selection
- Choose "Python 3.11" from dropdown

**What the AI Coach watches for**:
- Runtime selector visible
- "python" and "3.11" are visible

**Common mistakes the AI Coach will catch**:
- Selecting Python 3.9 or 3.10
- Selecting different language (Node.js, Go, etc.)

**Example AI Coaching**:
```
⚠️ "You've selected Python 3.9, but the requirement is Python 3.11.
Using the correct runtime ensures your function runs with the latest
features and security patches."
```

---

#### Step 5: Paste the hello_gcc function code
- Click "Next" to go to code editor
- Find the main function file (main.py)
- Replace the default code with:

```python
def hello_gcc(request):
    return "Hello from GCP!"
```

- Set entry point to: `hello_gcc`

**What the AI Coach watches for**:
- Code editor visible
- "hello_gcc" function name in code
- "return" statement present

**Example AI Coaching**:
```
✅ "I can see you've pasted the hello_gcc function code. Make sure to
set the 'Entry point' field to 'hello_gcc' (matching your function name)
so Cloud Functions knows which function to execute."
```

---

#### Step 6: Deploy the function
- Click "Deploy" button
- Wait for deployment to complete (can take 1-2 minutes)
- Watch for green checkmark or "Active" status

**What the AI Coach watches for**:
- Deploy button clicked
- Deployment in progress
- Success/active status

**Common mistakes the AI Coach will catch**:
- Missing IAM permissions
- Build errors in code
- Timeout during deployment

**Example AI Coaching**:
```
⚠️ "Deployment failed - I see an error message about missing IAM permissions.
You need the 'Cloud Functions Developer' role to deploy functions.
Go to IAM & Admin → IAM → Add your user with the required role."
```

---

#### Step 7: Test function URL returns 'Hello from GCP!'
- Copy the trigger URL from function details
- Open in browser or use curl
- Verify response is "Hello from GCP!"

**What the AI Coach watches for**:
- Test/trigger URL visible
- Response "hello from gcp" or "200 OK"

**Example AI Coaching**:
```
✅ "Perfect! Your function is deployed and responding correctly.
The URL returned 'Hello from GCP!' with a 200 OK status.
You've successfully deployed your first Cloud Function!"
```

---

## API Validation (Optional Advanced Steps)

### Storage Bucket Validation

Verify bucket creation via REST API:

```bash
curl -X GET \
  "https://storage.googleapis.com/storage/v1/b?project=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

Expected response should include:
```json
{
  "name": "onboarding-demo-bucket",
  "location": "US-CENTRAL1",
  "storageClass": "STANDARD",
  "iamConfiguration": {
    "uniformBucketLevelAccess": {
      "enabled": true
    }
  }
}
```

### Cloud Function Validation

Verify function deployment via REST API:

```bash
curl -X GET \
  "https://cloudfunctions.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/functions/helloGCC" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

Expected response should include:
```json
{
  "name": "projects/YOUR_PROJECT/locations/us-central1/functions/helloGCC",
  "status": "ACTIVE",
  "runtime": "python311",
  "httpsTrigger": {
    "url": "https://us-central1-YOUR_PROJECT.cloudfunctions.net/helloGCC"
  }
}
```

---

## How the AI Coach Helps

### Visual Analysis
The AI coach analyzes screenshots to detect:
- Which GCP console page you're on
- Form fields that are visible
- Values you've entered
- Error messages or warnings
- Success indicators

### Step-by-Step Guidance
For each step, the coach:
1. **Verifies** you're on the correct page
2. **Checks** required fields are filled correctly
3. **Detects** common mistakes before you submit
4. **Explains** why certain settings matter
5. **Celebrates** when you complete steps correctly

### Coaching Style
The AI coach acts like a senior engineer:
- **Patient**: Assumes you're learning
- **Educational**: Explains WHY, not just WHAT
- **Specific**: Gives exact field names and values
- **Supportive**: Celebrates progress
- **Proactive**: Catches mistakes before they cause issues

### Example Coaching Flow

```
Step 2 - Naming the bucket

👁️ AI sees: GCP Storage console, "Create bucket" form visible

✅ "Perfect! You're on the Create Bucket page. Now let's name your bucket."

[User types "OnboardingBucket"]

⚠️ "Hold on - bucket names must be all lowercase. I see you used 'OnboardingBucket'
with uppercase letters. Change it to 'onboarding-demo-bucket' (all lowercase,
with hyphens). This is a GCP requirement - bucket names are globally unique
and must follow DNS naming conventions."

[User corrects to "onboarding-demo-bucket"]

✅ "Excellent! That's the correct format. Now move to the next step:
selecting the region 'us-central1'."
```

---

## Tips for Success

### For Storage Bucket Task:
- Have the exact bucket name ready: `onboarding-demo-bucket`
- Remember: lowercase only, hyphens allowed
- Ensure you have Storage Admin role
- Create a simple `hello.txt` file beforehand for upload

### For Cloud Function Task:
- Copy the function code before starting
- Ensure you have Cloud Functions Developer role
- Be patient - first deployment can take 2-3 minutes
- Test the URL in an incognito window to avoid auth issues

### If the AI Gets Confused:
- Use the **Prev/Next** buttons in the extension popup to manually adjust steps
- Press **Alt+O** to hide/show the guidance panel
- Check the extension's Console tab (F12) for detailed logs
- Restart monitoring if you navigate away from GCP Console

---

## Troubleshooting

### "AI says I'm on wrong step"
- Manually adjust step using Prev/Next buttons
- Ensure you're on the correct GCP console page
- Wait 10 seconds for next screenshot analysis

### "Deployment failed but no guidance"
- Check GCP Console for error details
- Verify IAM permissions in IAM & Admin
- Check Cloud Functions logs for build errors

### "Public access warning won't go away"
- Ensure you selected "Uniform" access control
- Toggle "Prevent public access" to ON
- Click "Confirm" if there's a confirmation dialog

---

## Summary

The AI Onboarding Coach helps you learn GCP by:
- Watching your screen in real-time
- Comparing your actions to best practices
- Catching mistakes before they happen
- Explaining the reasoning behind each step
- Building confidence through guided practice

This creates a safe learning environment where mistakes become teaching moments!
