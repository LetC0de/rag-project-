from dotenv import load_dotenv
import os

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import MistralAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate


load_dotenv()

print("📚 RAG Book Assistant")
print("=" * 50)

pdf_path = input("\nEnter PDF file path (or press Enter to skip): ").strip()

if pdf_path and os.path.exists(pdf_path):
    file_path = pdf_path
    print("✓ PDF file found!")

    create = input("Create vector database? (y/n): ").strip().lower()

    if create == 'y':
        print("\nProcessing document...")

        loader = PyPDFLoader(file_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )

        chunks = splitter.split_documents(docs)

        embeddings = MistralAIEmbeddings(
            model="mistral-embed-2312"
            )

        vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory="chroma_db"
        )

        vectorstore.persist()

        print("✓ Vector database created!")

elif pdf_path:
    print(f"Error: PDF file not found at '{pdf_path}'")



if os.path.exists("chroma_db"):

    embeddings =  MistralAIEmbeddings(
    model="mistral-embed-2312"
    )

    vectorstore = Chroma(
        persist_directory="chroma_db",
        embedding_function=embeddings
    )

    def detect_query_type(question):
        """Detect if query is asking for summary/overview or specific facts"""
        question_lower = question.lower().strip()

        summary_keywords = [
            "summary", "summarize", "summarise",
            "about this document", "about the document", "about this pdf",
            "overview", "main points", "key points",
            "what is this", "tell me about", "explain this",
            "describe", "introduction", "content of",
            "what does this document", "document about"
        ]

        return any(keyword in question_lower for keyword in summary_keywords)

    def get_retriever(question):
        """Get appropriate retriever based on query type"""
        is_summary_query = detect_query_type(question)

        if is_summary_query:
            return vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 6}
            )
        else:
            return vectorstore.as_retriever(
                search_type="mmr",
                search_kwargs={
                    "k": 4,
                    "fetch_k": 10,
                    "lambda_mult": 0.5
                }
            )

    llm = ChatMistralAI(model="mistral-small-2506")

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a helpful AI assistant specialized in answering questions about documents.

**Your Task:**
- Use the provided context to answer the user's question accurately.
- If the user asks for a summary, overview, or explanation, provide a clear and comprehensive summary based on the context.
- If the user asks a specific question, answer it directly using the context.
- Handle minor spelling mistakes or typos gracefully by understanding the intent.

**Important Rules:**
- Base your answer ONLY on the provided context.
- Do not make up or hallucinate information not present in the context.
- If you cannot find relevant information in the context, say: "I could not find enough information in the document to answer this question."
- Be conversational and helpful in your responses.
- For summary requests, organize information clearly with key points.
"""
            ),
            (
                "human",
                """Context from the document:
{context}

User's Question:
{question}

Please provide a helpful answer based on the context above.
"""
            )
        ]
    )

    print("\n" + "=" * 50)
    print("Ask Questions From the PDF")
    print("(Type 'exit' to quit)")
    print("=" * 50)

    while True:
        query = input("\nYour question: ").strip()

        if query.lower() == 'exit':
            print("\nGoodbye!")
            break

        if query:
            print("\nSearching...")

            retriever = get_retriever(query)
            docs = retriever.invoke(query)

            context = "\n\n".join(
                [doc.page_content for doc in docs]
            )

            final_prompt = prompt.invoke({
                "context": context,
                "question": query
            })

            response = llm.invoke(final_prompt)

            print("\n### AI Answer:")
            print(response.content)
else:
    print("\nNo vector database found. Please create one first by providing a PDF file.")
